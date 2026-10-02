// Stress test: 10 concurrent clients each add a block to the same document at
// nearly the same moment. Passes if all 10 edits merge with none lost, both in
// the live session and in MongoDB afterwards.
const crypto = require('crypto');
const Y = require('yjs');
const { setupTestSession, createClient, cleanupTestSession, Document } = require('./testHelpers');

const NUM_CLIENTS = 10;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const session = await setupTestSession({ title: 'Stress Test Document' });
  const { documentId } = session;
  console.log(`🚀 Starting stress test with ${NUM_CLIENTS} concurrent clients on document ${documentId}`);

  const clients = [];
  let connected = 0;
  let editsSent = 0;

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const client = createClient(session);
    const clientName = `Client-${i + 1}`;
    let editScheduled = false;

    client.on('connect', () => {
      connected++;
      client.emit('join-document', documentId);
      client.emit('presence-join', { documentId, name: clientName, color: '#4A90D9' });
      if (connected === NUM_CLIENTS) console.log(`✅ All ${NUM_CLIENTS} clients connected and authenticated.`);
    });

    client.on('sync-init', (state) => {
      if (editScheduled) return;
      editScheduled = true;

      // Each client makes its own edit shortly after joining (staggered a little,
      // like real concurrent typing)
      setTimeout(() => {
        const localDoc = new Y.Doc();
        Y.applyUpdate(localDoc, new Uint8Array(state));
        const yArray = localDoc.getArray('content');

        const text = `Edit from ${clientName}`;
        yArray.push([{ nodeId: crypto.randomUUID(), type: 'paragraph', content: text, text }]);

        const update = Array.from(Y.encodeStateAsUpdate(localDoc));
        client.emit('sync-update', { documentId, update });
        editsSent++;
        if (editsSent === NUM_CLIENTS) console.log(`✍️  All ${NUM_CLIENTS} concurrent edits sent.`);
      }, Math.random() * 500);
    });

    clients.push(client);
  }

  // Give the edits time to be sent and merged
  await wait(4000);
  console.log('⏳ Verifying the live merged state...');

  // 1) Live check: a fresh client joining receives the merged Yjs state
  const verifier = createClient(session);
  const liveBlocks = await new Promise((resolve) => {
    verifier.on('connect', () => verifier.emit('join-document', documentId));
    verifier.on('sync-init', (state) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(state));
      resolve(doc.getArray('content').toArray());
    });
  });

  console.log(`📊 Live state has ${liveBlocks.length} block(s):`);
  liveBlocks.forEach((b, i) => console.log(`   ${i + 1}. ${b.content || b.text}`));
  const livePassed = liveBlocks.length === NUM_CLIENTS;

  // 2) Persistence check: when the last client leaves, the server saves to MongoDB
  clients.forEach((c) => c.disconnect());
  verifier.disconnect();
  await wait(2000);

  const saved = await Document.findById(documentId).lean();
  const savedCount = saved && Array.isArray(saved.content) ? saved.content.length : 0;
  console.log(`💾 MongoDB has ${savedCount} saved block(s).`);
  const dbPassed = savedCount === NUM_CLIENTS;

  if (livePassed && dbPassed) {
    console.log(`\n✅ TEST PASSED — all ${NUM_CLIENTS} concurrent edits merged and saved without loss or crash!`);
  } else {
    console.log(`\n❌ TEST FAILED — expected ${NUM_CLIENTS} blocks (live: ${liveBlocks.length}, saved: ${savedCount}).`);
  }

  await cleanupTestSession(session);
  process.exit(livePassed && dbPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Stress test crashed:', err);
  process.exit(1);
});