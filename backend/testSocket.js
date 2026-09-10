const { io } = require('socket.io-client');
const Y = require('yjs');

const DOC_ID = 'test-document-123';

// Simulate User A
const userA = io('http://localhost:5000');
// Simulate User B
const userB = io('http://localhost:5000');

userA.on('connect', () => {
  console.log('✅ User A connected:', userA.id);
  userA.emit('join-document', DOC_ID);
});

userB.on('connect', () => {
  console.log('✅ User B connected:', userB.id);
  userB.emit('join-document', DOC_ID);

  // After joining, wait a moment, then simulate User A sending an edit
  setTimeout(() => {
    console.log('✍️  User A making a real Yjs edit...');
    const localDoc = new Y.Doc();
    const yText = localDoc.getText('content');
    yText.insert(0, 'Hello from User A');
    const realUpdate = Array.from(Y.encodeStateAsUpdate(localDoc));
    userA.emit('sync-update', { documentId: DOC_ID, update: realUpdate });
  }, 1000);
});

userA.on('sync-init', (state) => {
  console.log('📥 User A received initial state, length:', state.length);
});

userB.on('sync-init', (state) => {
  console.log('📥 User B received initial state, length:', state.length);
});

userB.on('sync-update', (update) => {
  console.log('🎉 User B received a real-time update from User A! Length:', update.length);
  console.log('✅ TEST PASSED — real-time sync is working!');
  process.exit(0);
});

setTimeout(() => {
  console.log('❌ TEST FAILED — no update received within 5 seconds.');
  process.exit(1);
}, 5000);