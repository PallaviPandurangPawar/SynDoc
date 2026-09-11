const { io } = require('socket.io-client');
const Y = require('yjs');

const DOC_ID = '6aa4592613bbc6116c144186'; // the _id from your earlier create request

const client = io('http://localhost:5000');

client.on('connect', () => {
  console.log('✅ Connected:', client.id);
  client.emit('join-document', DOC_ID);
});

client.on('sync-init', (state) => {
  console.log('📥 Received initial state, length:', state.length);

  const localDoc = new Y.Doc();
  Y.applyUpdate(localDoc, new Uint8Array(state));
  const yText = localDoc.getText('content');

  const currentContent = yText.toString();
  const parsed = currentContent ? JSON.parse(currentContent) : [];
  parsed.push({ type: 'paragraph', text: 'appended via CRDT test' });

  yText.delete(0, yText.length);
  yText.insert(0, JSON.stringify(parsed));

  const update = Array.from(Y.encodeStateAsUpdate(localDoc));
  console.log('✍️  Sending edit...');
  client.emit('sync-update', { documentId: DOC_ID, update });

  console.log('⏳ Waiting 3 seconds for debounced save to MongoDB...');
  setTimeout(() => {
    console.log('✅ Done — now check MongoDB via GET request.');
    process.exit(0);
  }, 3000);
});