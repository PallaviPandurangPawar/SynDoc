// Checks the Yjs WebSocket connection (the transport the editor uses):
//  1. a login token is required,
//  2. two WebSocket clients typing in the SAME block at the same time both keep their text,
//  3. the merged result is saved to MongoDB,
//  4. a Socket.io client joining afterwards sees the same merged text (both transports share one document).
const Y = require('yjs');
const WebSocket = require('ws');
const { WebsocketProvider } = require('y-websocket');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await wait(50);
  }
  return false;
}

function connect(wsBase, documentId, token) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(wsBase, documentId, doc, {
    params: { token },
    WebSocketPolyfill: WebSocket,
    disableBc: true // no shortcuts between clients: everything must go through the server
  });
  return { doc, provider };
}

const blockText = (doc) => {
  const first = doc.getArray('content').get(0);
  return first && first.get ? String(first.get('content')) : '';
};

async function runScenario({ wsBase, documentId, token }) {
  const out = {};

  // 1) A wrong token must be refused
  const bad = connect(wsBase, documentId, 'not-a-real-token');
  await wait(1500);
  out.badTokenRefused = bad.provider.wsconnected === false;
  bad.provider.destroy();

  // 2) Two real clients
  const a = connect(wsBase, documentId, token);
  out.clientAConnected = await waitFor(() => a.provider.synced);

  // A creates the first block (text can only be typed once the block is in the document)
  a.doc.transact(() => {
    const block = new Y.Map();
    block.set('nodeId', 'ws-test-block');
    block.set('type', 'paragraph');
    block.set('attributes', {});
    block.set('content', new Y.Text());
    a.doc.getArray('content').push([block]);
    block.get('content').insert(0, 'middle');
  });

  const b = connect(wsBase, documentId, token);
  out.clientBConnected = await waitFor(() => b.provider.synced);
  out.bSeesBlock = await waitFor(() => blockText(b.doc) === 'middle');
  if (!out.bSeesBlock) {
    // Report the failure instead of crashing
    out.merged = false;
    out.textA = blockText(a.doc);
    out.textB = blockText(b.doc);
    return { out, clients: [a, b] };
  }

  // Both type in the same block in the same moment, before either sees the other's change
  const textA = a.doc.getArray('content').get(0).get('content');
  const textB = b.doc.getArray('content').get(0).get('content');
  textA.insert(0, 'START ');
  textB.insert(textB.length, ' END');

  out.merged = await waitFor(
    () => blockText(a.doc) === 'START middle END' && blockText(b.doc) === 'START middle END'
  );
  out.textA = blockText(a.doc);
  out.textB = blockText(b.doc);

  return { out, clients: [a, b] };
}

module.exports = { runScenario };

// ───────── Real run against your server and MongoDB ─────────
if (require.main === module) {
  const Y2 = require('yjs');
  const { setupTestSession, createClient, cleanupTestSession, Document } = require('./testHelpers');

  (async () => {
    const session = await setupTestSession({ title: 'Yjs WebSocket Test' });
    const wsBase = session.serverUrl.replace(/^http/, 'ws') + '/yjs';
    console.log(`🔌 Connecting through ${wsBase}/${session.documentId}`);

    const { out, clients } = await runScenario({ wsBase, documentId: session.documentId, token: session.token });

    const tick = (ok) => (ok ? '✅' : '❌');
    console.log(`${tick(out.badTokenRefused)} connection with a wrong token was refused`);
    console.log(`${tick(out.clientAConnected && out.clientBConnected)} two clients connected over WebSocket`);
    console.log(`${tick(out.bSeesBlock)} client B received the block created by client A`);
    console.log(`${tick(out.merged)} simultaneous typing merged: A sees "${out.textA}", B sees "${out.textB}"`);

    // Wait for the server's debounced save, then leave so the server saves right away
    await wait(1000);
    clients.forEach((c) => c.provider.destroy());
    await wait(2500);

    const saved = await Document.findById(session.documentId).lean();
    const savedText = saved && saved.content && saved.content[0] && saved.content[0].content;
    const dbOk = savedText === 'START middle END';
    console.log(`${tick(dbOk)} MongoDB saved: "${savedText}"`);

    // A Socket.io client (the fallback transport) must see the same document
    const ioClient = createClient(session);
    const ioBlocks = await new Promise((resolve) => {
      ioClient.on('connect', () => ioClient.emit('join-document', session.documentId));
      ioClient.once('sync-init', (state) => {
        const d = new Y2.Doc();
        Y2.applyUpdate(d, new Uint8Array(state));
        resolve(d.getArray('content').toJSON());
      });
    });
    const ioOk = ioBlocks[0] && ioBlocks[0].content === 'START middle END';
    console.log(`${tick(ioOk)} a Socket.io client sees the same text: "${ioBlocks[0] && ioBlocks[0].content}"`);
    ioClient.disconnect();
    await wait(1500);

    const all = out.badTokenRefused && out.clientAConnected && out.clientBConnected && out.bSeesBlock && out.merged && dbOk && ioOk;
    console.log(all ? '\n✅ TEST PASSED — the Yjs WebSocket works, is protected, and shares one document with Socket.io.'
                    : '\n❌ TEST FAILED — see the ❌ lines above.');
    await cleanupTestSession(session);
    process.exit(all ? 0 : 1);
  })().catch((err) => { console.error('❌ Test crashed:', err); process.exit(1); });
}