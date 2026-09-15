const { io } = require('socket.io-client');

const DOC_ID = 'lock-test-doc';
const NODE_ID = 'block-1';

const userA = io('http://localhost:5000');
const userB = io('http://localhost:5000');

userA.on('connect', () => {
  console.log('✅ User A connected:', userA.id);
  userA.emit('join-document', DOC_ID);
  userA.emit('lock-block', { documentId: DOC_ID, nodeId: NODE_ID, userName: 'Alice' });
});

userB.on('connect', () => {
  console.log('✅ User B connected:', userB.id);
  userB.emit('join-document', DOC_ID);

  // Try to lock the SAME block shortly after Alice does
  setTimeout(() => {
    console.log('🔒 Bob attempting to lock the same block Alice holds...');
    userB.emit('lock-block', { documentId: DOC_ID, nodeId: NODE_ID, userName: 'Bob' });
  }, 500);
});

const failTimer = setTimeout(() => {
  console.log('❌ TEST FAILED — lock-denied was never received within 5 seconds.');
  process.exit(1);
}, 5000);

userB.on('lock-denied', async ({ nodeId, lockedBy }) => {
  clearTimeout(failTimer);
  console.log(`✅ Bob correctly denied lock on "${nodeId}" (held by ${lockedBy})`);

  console.log('🌐 Checking REST endpoint while lock is still active...');
  const response = await fetch(`http://localhost:5000/api/documents/${DOC_ID}/locks`);
  const result = await response.json();
  console.log('📥 REST response:', JSON.stringify(result));

  if (result.success && result.data.some(l => l.nodeId === nodeId && l.userName === 'Alice')) {
    console.log('✅ TEST PASSED — REST endpoint correctly shows the active lock!');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED — REST endpoint did not show the expected lock.');
    process.exit(1);
  }
});

userA.on('lock-update', (locks) => {
  console.log('📋 Lock state update:', JSON.stringify(locks.map(l => ({ nodeId: l.nodeId, user: l.userName }))));
});