const { io } = require('socket.io-client');
const Y = require('yjs');

const DOC_ID = '6aa56a554d32f3c2b51d9b25'; // Clean Sync Test document

const client = io('http://localhost:5000');

client.on('connect', () => {
  console.log('✅ Connected:', client.id);
  client.emit('join-document', DOC_ID);
});

client.on('sync-init', (state) => {
  console.log('📥 Received initial state, length:', state.length);

  const localDoc = new Y.Doc();
  Y.applyUpdate(localDoc, new Uint8Array(state));
  const yArray = localDoc.getArray('content');

  yArray.push([{ type: 'paragraph', text: 'appended via CRDT test' }]);

  const update = Array.from(Y.encodeStateAsUpdate(localDoc));
  console.log('✍️  Sending edit...');
  client.emit('sync-update', { documentId: DOC_ID, update });

  console.log('⏳ Waiting 3 seconds for debounced save to MongoDB...');
  setTimeout(() => {
    console.log('✅ Done — now check MongoDB via GET request.');
    process.exit(0);
  }, 3000);
});