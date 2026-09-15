const { io } = require('socket.io-client');
const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');

const DOC_ID = 'bridge-test-' + Date.now();

// Client A: connects via Socket.io (our custom protocol)
const socketClient = io('http://localhost:5000');

// Client B: connects via native y-websocket
const docB = new Y.Doc();
const providerB = new WebsocketProvider('ws://localhost:5000', DOC_ID, docB, {
  WebSocketPolyfill: WebSocket,
  resyncInterval: 0
});

let testFinished = false;
function finish(success, message) {
  if (testFinished) return;
  testFinished = true;
  providerB.destroy();
  docB.destroy();
  socketClient.disconnect();
  console.log(success ? `✅ ${message}` : `❌ ${message}`);
  process.exit(success ? 0 : 1);
}

let forwardPassed = false;
let reversePassed = false;

function checkBothDirections() {
  if (forwardPassed && reversePassed) {
    clearTimeout(timer);
    finish(true, 'TEST PASSED — bridge works correctly in BOTH directions!');
  }
}

const timer = setTimeout(() => {
  finish(false, `TEST FAILED after 8 seconds — forward: ${forwardPassed}, reverse: ${reversePassed}`);
}, 8000);

socketClient.on('connect', () => {
  console.log('✅ Socket.io client connected:', socketClient.id);
  socketClient.emit('join-document', DOC_ID);
});

let localDoc = null; // shared, persistent — represents this Socket.io client's own document state

socketClient.on('sync-init', (state) => {
  console.log('📥 Socket.io client received initial state, sending edit...');

  localDoc = new Y.Doc();
  Y.applyUpdate(localDoc, new Uint8Array(state));
  const yArray = localDoc.getArray('content');
  yArray.push([{ type: 'paragraph', text: 'Hello from Socket.io side' }]);

  const update = Array.from(Y.encodeStateAsUpdate(localDoc));
  socketClient.emit('sync-update', { documentId: DOC_ID, update });

  // After 2 seconds, also send an edit from the y-websocket side
  setTimeout(() => {
    console.log('✍️  Sending edit from y-websocket side...');
    const yArrayB = docB.getArray('content');
    yArrayB.push([{ type: 'paragraph', text: 'Hello from y-websocket side' }]);
  }, 2000);
});

// Watch the y-websocket client's own Y.Array for the update arriving
const yArrayB = docB.getArray('content');
yArrayB.observe(() => {
  const items = yArrayB.toArray();
  console.log('📥 y-websocket client sees content:', JSON.stringify(items));
  if (items.some(item => item.text === 'Hello from Socket.io side')) {
    forwardPassed = true;
    console.log('✅ Forward direction (Socket.io -> y-websocket) confirmed');
    checkBothDirections();
  }
});

// --- Reverse direction: does a y-websocket edit reach the Socket.io client? ---
socketClient.on('sync-update', (update) => {
  if (!localDoc) return; // ignore updates before we've received our own initial state
  Y.applyUpdate(localDoc, new Uint8Array(update));
  const items = localDoc.getArray('content').toArray();
  console.log('📥 Socket.io client received a sync-update:', JSON.stringify(items));
  if (items.some(item => item.text === 'Hello from y-websocket side')) {
    reversePassed = true;
    console.log('✅ Reverse direction (y-websocket -> Socket.io) confirmed');
    checkBothDirections();
  }
});