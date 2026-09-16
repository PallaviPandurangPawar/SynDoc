const { io } = require('socket.io-client');

const DOC_ID = 'presence-lock-test';
const NODE_ID = 'block-1';

const userA = io('http://localhost:5000');

userA.on('connect', () => {
  console.log('✅ User A connected:', userA.id);
  userA.emit('join-document', DOC_ID);
  userA.emit('presence-join', { documentId: DOC_ID, name: 'Alice', color: '#FF5733' });

  setTimeout(() => {
    console.log('🔒 Alice locking block-1...');
    userA.emit('lock-block', { documentId: DOC_ID, nodeId: NODE_ID, userName: 'Alice' });
  }, 500);
});

userA.on('presence-update', (users) => {
  console.log('👥 Presence update:', JSON.stringify(users.map(u => ({ name: u.name, lockedBlockId: u.lockedBlockId }))));

  const alice = users.find(u => u.name === 'Alice');
  if (alice && alice.lockedBlockId === NODE_ID) {
    console.log('✅ TEST PASSED — presence data correctly reflects Alice\'s active lock!');
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('❌ TEST FAILED — presence never showed the lock within 5 seconds.');
  process.exit(1);
}, 5000);