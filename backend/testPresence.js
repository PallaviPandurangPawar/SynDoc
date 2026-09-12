const { io } = require('socket.io-client');

const DOC_ID = 'presence-test-doc';

const userA = io('http://localhost:5000');
const userB = io('http://localhost:5000');

userA.on('connect', () => {
  console.log('✅ User A connected:', userA.id);
  userA.emit('join-document', DOC_ID);
  userA.emit('presence-join', { documentId: DOC_ID, name: 'Alice', color: '#FF5733' });
});

userB.on('connect', () => {
  console.log('✅ User B connected:', userB.id);
  userB.emit('join-document', DOC_ID);
  userB.emit('presence-join', { documentId: DOC_ID, name: 'Bob', color: '#33A1FF' });
});

userA.on('presence-update', (users) => {
  console.log('👥 User A sees active users:', users.map(u => u.name));
});

userB.on('presence-update', (users) => {
  console.log('👥 User B sees active users:', users.map(u => u.name));

  if (users.length === 2) {
    console.log('✅ TEST PASSED — both users visible in presence!');
    setTimeout(() => process.exit(0), 500);
  }
});

setTimeout(() => {
  console.log('❌ TEST FAILED — presence did not sync within 5 seconds.');
  process.exit(1);
}, 5000);