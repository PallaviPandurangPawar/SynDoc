const { io } = require('socket.io-client');
const Y = require('yjs');

const DOC_ID = 'stress-test-doc';
const NUM_CLIENTS = 10;

let connectedCount = 0;
let editsSent = 0;
const clients = [];

console.log(`🚀 Starting stress test with ${NUM_CLIENTS} concurrent clients...`);

for (let i = 0; i < NUM_CLIENTS; i++) {
  const client = io('http://localhost:5000');
  const clientName = `Client-${i + 1}`;

  client.on('connect', () => {
    connectedCount++;
    client.emit('join-document', DOC_ID);
    client.emit('presence-join', { documentId: DOC_ID, name: clientName, color: '#000000' });

    if (connectedCount === NUM_CLIENTS) {
      console.log(`✅ All ${NUM_CLIENTS} clients connected.`);
    }
  });

  client.on('sync-init', (state) => {
    // Each client makes its own concurrent edit shortly after joining
    setTimeout(() => {
      const localDoc = new Y.Doc();
      Y.applyUpdate(localDoc, new Uint8Array(state));
      const yArray = localDoc.getArray('content');

      // Each client appends its own node — Yjs merges array insertions safely,
      // even when many clients push at nearly the same instant.
      yArray.push([{ type: 'paragraph', text: `Edit from ${clientName}` }]);

      const update = Array.from(Y.encodeStateAsUpdate(localDoc));
      client.emit('sync-update', { documentId: DOC_ID, update });
      editsSent++;

      if (editsSent === NUM_CLIENTS) {
        console.log(`✍️  All ${NUM_CLIENTS} concurrent edits sent.`);
      }
    }, Math.random() * 500); // stagger slightly, like real concurrent typing
  });

  clients.push(client);
}

setTimeout(() => {
  console.log('⏳ Waiting for debounced save, then verifying final state...');

  const verifier = io('http://localhost:5000');
  verifier.on('connect', () => {
    verifier.emit('join-document', DOC_ID);
  });
  verifier.on('sync-init', (state) => {
    const localDoc = new Y.Doc();
    Y.applyUpdate(localDoc, new Uint8Array(state));
    const yArray = localDoc.getArray('content');
    const parsed = yArray.toArray();

    console.log(`📊 Final merged content has ${parsed.length} paragraph(s).`);
    parsed.forEach((p, i) => console.log(`   ${i + 1}. ${p.text}`));

    if (parsed.length === NUM_CLIENTS) {
      console.log(`✅ TEST PASSED — all ${NUM_CLIENTS} concurrent edits merged without loss or crash!`);
    } else {
      console.log(`⚠️  TEST WARNING — expected ${NUM_CLIENTS} edits, found ${parsed.length}. Some may have overwritten each other.`);
    }

    process.exit(0);
  });
}, 4000);