// Checks block locking (the "localized operational block-locking" of the plan):
//  1. one person can lock a block and everyone is told,
//  2. a second person is refused on a locked block but can lock a different one,
//  3. unlocking frees the block for others,
//  4. when someone disconnects, all their locks are released.
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
  const open = (name) => {
    const socket = io(serverUrl, { auth: { token } });
    const client = { socket, name, locks: [], denied: [] };
    socket.on('lock-update', (locks) => { client.locks = locks; });
    socket.on('lock-denied', (info) => client.denied.push(info));
    socket.on('connect', () => socket.emit('join-document', documentId));
    return client;
  };
  const ownerOf = (client, nodeId) => {
    const lock = client.locks.find((l) => l.nodeId === nodeId);
    return lock ? lock.userName : null;
  };
  const lock = (client, nodeId) =>
    client.socket.emit('lock-block', { documentId, nodeId, userName: client.name });

  const alice = open('Alice');
  const bob = open('Bob');
  // join-document makes the server send the current document, which tells us we are in the room
  await Promise.all([
    new Promise((resolve) => alice.socket.once('sync-init', resolve)),
    new Promise((resolve) => bob.socket.once('sync-init', resolve))
  ]);

  // 1) Alice locks block n1: both see it
  lock(alice, 'n1');
  out.lockVisibleToBoth = await waitFor(() => ownerOf(alice, 'n1') === 'Alice' && ownerOf(bob, 'n1') === 'Alice');

  // 2) Bob is refused on n1, but can lock n2
  lock(bob, 'n1');
  out.bobRefused = await waitFor(() => bob.denied.some((d) => d.nodeId === 'n1' && d.lockedBy === 'Alice'));
  lock(bob, 'n2');
  out.bobLocksOther = await waitFor(() => ownerOf(alice, 'n2') === 'Bob');

  // 3) Alice unlocks n1: Bob can now take it
  alice.socket.emit('unlock-block', { documentId, nodeId: 'n1' });
  out.unlockVisible = await waitFor(() => ownerOf(bob, 'n1') === null);
  lock(bob, 'n1');
  out.bobTakesFreedBlock = await waitFor(() => ownerOf(alice, 'n1') === 'Bob');

  // 4) Bob disconnects: his locks (n1 and n2) are released for Alice
  bob.socket.disconnect();
  out.disconnectReleases = await waitFor(() => ownerOf(alice, 'n1') === null && ownerOf(alice, 'n2') === null);

  alice.socket.disconnect();
  return out;
}

module.exports = { runScenario };

// ───────── Real run against your server and MongoDB ─────────
if (require.main === module) {
  const { setupTestSession, cleanupTestSession } = require('./testHelpers');

  (async () => {
    const session = await setupTestSession({ title: 'Lock Test' });
    const out = await runScenario({ serverUrl: session.serverUrl, token: session.token, documentId: session.documentId });

    const tick = (ok) => (ok ? '✅' : '❌');
    console.log(`${tick(out.lockVisibleToBoth)} a lock taken by Alice is visible to Alice and Bob`);
    console.log(`${tick(out.bobRefused)} Bob is refused on the block Alice holds`);
    console.log(`${tick(out.bobLocksOther)} Bob can lock a different block at the same time`);
    console.log(`${tick(out.unlockVisible)} unlocking frees the block for everyone`);
    console.log(`${tick(out.bobTakesFreedBlock)} Bob can take the block once it is free`);
    console.log(`${tick(out.disconnectReleases)} when Bob disconnects, all his locks are released`);

    const all = Object.values(out).every(Boolean);
    console.log(all ? '\n✅ TEST PASSED — block locking works.' : '\n❌ TEST FAILED — see the ❌ lines above.');

    await cleanupTestSession(session);
    process.exit(all ? 0 : 1);
  })().catch((err) => { console.error('❌ Test crashed:', err); process.exit(1); });
}