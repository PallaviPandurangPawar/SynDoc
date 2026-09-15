const { Server } = require('socket.io');
const registerSyncHandlers = require('./syncHandler');
const registerPresenceHandlers = require('./presenceHandler');
const registerLockHandlers = require('./lockHandler');
const { initWebSocket, getYDocs } = require('./websocket');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

    registerSyncHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerLockHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  // Initialize WebSocket / y-websocket server on the same HTTP server
  const wss = initWebSocket(server, io);
  io.wss = wss;

  console.log(`⚡ [Realtime] Socket.io and WebSocket (y-websocket) initialized`);

  return io;
};

initSocket.initSocket = initSocket;
initSocket.initWebSocket = initWebSocket;
initSocket.getYDocs = getYDocs;

module.exports = initSocket;


