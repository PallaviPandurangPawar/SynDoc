const { io } = require('socket.io-client');

const DOC_ID = 'cursor-test-doc';

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

  setTimeout(() => {
    console.log('🖱️  Alice moves her cursor...');
    userA.emit('presence-cursor', { documentId: DOC_ID, cursor: { nodeId: 'block-1', offset: 12 } });
  }, 500);
});

// Bob should see Alice's cursor update
userB.on('presence-update', (users) => {
  const alice = users.find(u => u.name === 'Alice');
  if (alice && alice.cursor && alice.cursor.offset === 12) {
    console.log('✅ TEST PASSED — Bob correctly received Alice\'s live cursor position!');
    console.log('   Alice\'s cursor:', JSON.stringify(alice.cursor));
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('❌ TEST FAILED — cursor update never reached Bob within 5 seconds.');
  process.exit(1);
}, 5000);