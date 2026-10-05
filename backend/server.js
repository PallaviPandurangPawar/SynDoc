require('./src/config/env');
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocket = require('./src/sockets');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
        const io = initSocket(server);
    app.set('io', io);


    // Permanently remove files whose Trash time has run out (now, then once an hour)
    const documentService = require('./src/services/documentService');
    const cleanTrash = async () => {
      try {
        const removed = await documentService.purgeExpiredTrash();
        if (removed > 0) console.log(`🗑️ [Trash] Permanently removed ${removed} expired document(s)`);
      } catch (error) {
        console.error(`⚠️ [Trash] Cleanup failed: ${error.message}`);
      }
    };
    cleanTrash();
    setInterval(cleanTrash, 60 * 60 * 1000);

    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 SyncDoc Backend running on port ${PORT}`);
      console.log(`📡 HTTP: http://localhost:${PORT}`);
      console.log(`🔌 Socket.io: http://localhost:${PORT}/socket.io/`);
      console.log(`⚡ WebSocket (Yjs): ws://localhost:${PORT}`);
      console.log(`🩺 Health: http://localhost:${PORT}/health`);
      console.log(`=========================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`👉 Another process is already running on port ${PORT}.`);
        console.error(`👉 Close that process or change PORT in .env`);
      } else {
        console.error(`❌ Server error: ${err.message}`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error(`❌ Server startup error: ${error.message}`);
    process.exit(1);
  }
};

startServer();

