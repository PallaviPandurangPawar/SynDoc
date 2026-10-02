// Checks live cursors and selections:
//  1. a cursor with character positions (start/end) reaches the other user,
//  2. rapid movement is throttled but the FINAL position always arrives,
//  3. clearing the cursor works,
//  4. bad data (wrong types, odd colours, huge names) is cleaned by the server.
const { io } = require('socket.io-client');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await wait(25);
  }
  return false;
}

async function runScenario({ serverUrl, token, documentId }) {
  const out = {};
  const open = (name, color) => {
    const socket = io(serverUrl, { auth: { token } });
    const updates = []; // every presence-update this socket received
    socket.on('presence-update', (users) => updates.push(users));
    socket.on('connect', () => socket.emit('presence-join', { documentId, name, color }));
    return { socket, updates, name };
  };
  const latest = (client) => client.updates[client.updates.length - 1] || [];
  const find = (client, name) => latest(client).find((u) => u.name === name);

  const alice = open('Alice', '#E74C3C');
  const bob = open('Bob', '#2ECC71');
  out.joined = await waitFor(() => find(bob, 'Alice') && find(alice, 'Bob'));

  // 1) A cursor with a selection
  alice.socket.emit('presence-cursor', { documentId, cursor: { blockIndex: 0, nodeId: 'n1', start: 3, end: 8 } });
  out.selectionArrived = await waitFor(() => {
    const c = find(bob, 'Alice') && find(bob, 'Alice').cursor;
    return c && c.nodeId === 'n1' && c.start === 3 && c.end === 8;
  });

  // 2) 30 quick moves: far fewer broadcasts than moves, but the last position wins
  await wait(150);
  const before = bob.updates.length;
  for (let i = 1; i <= 30; i++) {
    alice.socket.emit('presence-cursor', { documentId, cursor: { blockIndex: 0, nodeId: 'n1', start: i, end: i } });
  }
  out.finalPositionArrived = await waitFor(() => {
    const c = find(bob, 'Alice') && find(bob, 'Alice').cursor;
    return c && c.start === 30;
  });
  await wait(200);
  out.broadcastsForBurst = bob.updates.length - before;
  out.throttled = out.broadcastsForBurst < 30;

  // 3) Clearing the cursor
  alice.socket.emit('presence-cursor', { documentId, cursor: null });
  out.clearedArrived = await waitFor(() => find(bob, 'Alice') && find(bob, 'Alice').cursor === null);

  // 4) Bad data is cleaned
  alice.socket.emit('presence-cursor', {
    documentId,
    cursor: { blockIndex: 'x', nodeId: 12345, start: '<script>', end: -50, extra: 'ignored' }
  });
  out.badCursorCleaned = await waitFor(() => {
    const c = find(bob, 'Alice') && find(bob, 'Alice').cursor;
    return c && c.start === 0 && c.end === 0 && !('extra' in c) && !('nodeId' in c) && !('blockIndex' in c);
  });

  const eve = open('E'.repeat(200), 'red;background:url(//evil.example/x)');
  out.hostileJoinSeen = await waitFor(() => latest(bob).some((u) => u.name.startsWith('EEE')));
  const eveSeen = latest(bob).find((u) => u.name.startsWith('EEE'));
  out.nameShortened = Boolean(eveSeen) && eveSeen.name.length <= 40;
  out.colorReplaced = Boolean(eveSeen) && /^#[0-9a-fA-F]{6}$/.test(eveSeen.color);

  [alice, bob, eve].forEach((c) => c.socket.disconnect());
  return out;
}

module.exports = { runScenario };

// ───────── Real run against your server and MongoDB ─────────
if (require.main === module) {
  const { setupTestSession, cleanupTestSession } = require('./testHelpers');

  (async () => {
    const session = await setupTestSession({ title: 'Cursor Test' });
    const out = await runScenario({ serverUrl: session.serverUrl, token: session.token, documentId: session.documentId });

    const tick = (ok) => (ok ? '✅' : '❌');
    console.log(`${tick(out.joined)} two users joined and see each other`);
    console.log(`${tick(out.selectionArrived)} a selection (characters 3 to 8) reached the other user`);
    console.log(`${tick(out.finalPositionArrived)} after 30 quick moves the final position arrived`);
    console.log(`${tick(out.throttled)} the 30 moves were sent as only ${out.broadcastsForBurst} updates`);
    console.log(`${tick(out.clearedArrived)} clearing the cursor reached the other user`);
    console.log(`${tick(out.badCursorCleaned)} a cursor with bad data was cleaned by the server`);
    console.log(`${tick(out.nameShortened && out.colorReplaced)} an oversized name and a hostile colour were cleaned`);

    const all = out.joined && out.selectionArrived && out.finalPositionArrived && out.throttled &&
      out.clearedArrived && out.badCursorCleaned && out.nameShortened && out.colorReplaced;
    console.log(all ? '\n✅ TEST PASSED — live cursors and selections work.' : '\n❌ TEST FAILED — see the ❌ lines above.');

    await cleanupTestSession(session);
    process.exit(all ? 0 : 1);
  })().catch((err) => { console.error('❌ Test crashed:', err); process.exit(1); });
}