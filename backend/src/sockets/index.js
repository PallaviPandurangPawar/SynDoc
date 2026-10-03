const { Server } = require('socket.io');
const registerSyncHandlers = require('./syncHandler');
const registerPresenceHandlers = require('./presenceHandler');
const registerLockHandlers = require('./lockHandler');
const { initWebSocket, getYDocs } = require('./websocket');
const { authenticateToken } = require('../middlewares/auth');
const { corsOptions } = require('../config/cors');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: corsOptions.origin,
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/, '');
      const user = await authenticateToken(token);

      if (!user) return next(new Error('Not authorized'));
      socket.data.user = user;
      return next();
    } catch (error) {
      return next(new Error('Not authorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

    // Personal room: lets the server send notifications straight to this user
    socket.join(`user:${socket.data.user._id}`);

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