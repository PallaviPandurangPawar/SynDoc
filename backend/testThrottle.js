const { io } = require('socket.io-client');

const DOC_ID = 'throttle-test-doc';

const userA = io('http://localhost:5000');
const userB = io('http://localhost:5000');

let updatesReceived = 0;

userA.on('connect', () => {
  console.log('✅ User A connected:', userA.id);
  userA.emit('join-document', DOC_ID);
  userA.emit('presence-join', { documentId: DOC_ID, name: 'Alice' });
});

userB.on('connect', () => {
  console.log('✅ User B connected:', userB.id);
  userB.emit('join-document', DOC_ID);
  userB.emit('presence-join', { documentId: DOC_ID, name: 'Bob' });

  setTimeout(() => {
    console.log('🖱️  Alice rapidly moves her cursor 50 times over 200ms...');
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        userA.emit('presence-cursor', { documentId: DOC_ID, cursor: { offset: i } });
      }, i * 4); // roughly every 4ms — much faster than the 50ms throttle
    }
  }, 500);
});

userB.on('presence-update', (users) => {
  const alice = users.find(u => u.name === 'Alice');
  if (alice && alice.cursor) {
    updatesReceived++;
  }
});

setTimeout(() => {
  console.log(`📊 Bob received ${updatesReceived} presence-update events (out of 50 cursor moves sent).`);
  if (updatesReceived > 0 && updatesReceived < 50) {
    console.log('✅ TEST PASSED — throttling is working (fewer broadcasts than raw movements, but not zero).');
    process.exit(0);
  } else if (updatesReceived === 50) {
    console.log('⚠️  No throttling occurred — every single update was broadcast.');
    process.exit(1);
  } else {
    console.log('❌ TEST FAILED — no updates received at all.');
    process.exit(1);
  }
}, 2000);
