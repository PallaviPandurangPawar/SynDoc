const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');

const DOC_ID = 'test-websocket-doc-' + Date.now();
const SERVER_URL = process.env.WS_URL || 'ws://localhost:5000';

console.log(`Connecting to WebSocket server at ${SERVER_URL} for room: ${DOC_ID}`);

// Client A setup
const docA = new Y.Doc();
const providerA = new WebsocketProvider(SERVER_URL, DOC_ID, docA, {
  WebSocketPolyfill: WebSocket,
  resyncInterval: 0
});

// Client B setup
const docB = new Y.Doc();
const providerB = new WebsocketProvider(SERVER_URL, DOC_ID, docB, {
  WebSocketPolyfill: WebSocket,
  resyncInterval: 0
});

let testFinished = false;

function finish(success, message) {
  if (testFinished) return;
  testFinished = true;

  providerA.destroy();
  providerB.destroy();
  docA.destroy();
  docB.destroy();

  if (success) {
    console.log(`✅ ${message}`);
    process.exit(0);
  } else {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

// Timeout after 6 seconds
const timer = setTimeout(() => {
  finish(false, 'TEST FAILED — WebSocket sync timed out after 6 seconds');
}, 6000);

let connectedA = false;
let connectedB = false;

providerA.on('status', (event) => {
  console.log(`📡 Client A status: ${event.status}`);
  if (event.status === 'connected') {
    connectedA = true;
    checkAndSend();
  }
});

providerB.on('status', (event) => {
  console.log(`📡 Client B status: ${event.status}`);
  if (event.status === 'connected') {
    connectedB = true;
    checkAndSend();
  }
});

function checkAndSend() {
  if (connectedA && connectedB) {
    console.log('🤝 Both clients connected via WebSocket. Sending update from Client A...');
    setTimeout(() => {
      const yTextA = docA.getText('content');
      yTextA.insert(0, 'Hello from WebSocket Client A!');
    }, 500);
  }
}

// Observe changes on Client B
const yTextB = docB.getText('content');
yTextB.observe((event) => {
  const text = yTextB.toString();
  console.log(`📥 Client B received text via WebSocket: "${text}"`);
  if (text.includes('Hello from WebSocket Client A!')) {
    clearTimeout(timer);
    finish(true, 'TEST PASSED — WebSocket (y-websocket) real-time sync is working perfectly!');
  }
});
