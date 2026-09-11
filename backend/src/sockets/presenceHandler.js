const presenceService = require('../services/presenceService');

/**
 * Registers all presence-related event listeners for a single connected socket.
 */
function registerPresenceHandlers(io, socket) {
  // Client announces they've joined a document with optional user info (name/color)
  socket.on('presence-join', ({ documentId, name, color }) => {
    presenceService.addUser(documentId, socket.id, { name, color });

    // Tell everyone else in the room who's now active
    const activeUsers = presenceService.getActiveUsers(documentId);
    io.to(documentId).emit('presence-update', activeUsers);

    console.log(`👤 [Presence] ${name || 'Anonymous'} (${socket.id}) joined document: ${documentId}`);
  });

  // Client moves their cursor/selection
  socket.on('presence-cursor', ({ documentId, cursor }) => {
    presenceService.updateCursor(documentId, socket.id, cursor);

    const activeUsers = presenceService.getActiveUsers(documentId);
    // Broadcast to everyone else (not back to the sender)
    socket.to(documentId).emit('presence-update', activeUsers);
  });

  // Clean up when this socket disconnects entirely
  socket.on('disconnect', () => {
    const documentId = socket.data.documentId;
    if (!documentId) return;

    presenceService.removeUser(documentId, socket.id);
    const activeUsers = presenceService.getActiveUsers(documentId);
    io.to(documentId).emit('presence-update', activeUsers);

    console.log(`👋 [Presence] Socket ${socket.id} left document: ${documentId}`);
  });
}

module.exports = registerPresenceHandlers;
