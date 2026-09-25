const presenceService = require('../services/presenceService');
const { findAccessibleDocument } = require('../middlewares/documentAccess');

// Tracks the last time each socket's cursor update was actually broadcast,
// so rapid cursor movement (e.g. every keystroke) doesn't flood the network.
const lastCursorBroadcast = new Map();
const CURSOR_THROTTLE_MS = 50; // at most ~20 broadcasts/sec per user

/**
 * Registers all presence-related event listeners for a single connected socket.
 */
function registerPresenceHandlers(io, socket) {
  // Client announces they've joined a document with optional user info (name/color)
  socket.on('presence-join', async ({ documentId, name, color }) => {
    if (!documentId) return;
    if (socket.data.documentId && socket.data.documentId !== documentId) return;

    const document = await findAccessibleDocument(documentId, socket.data.user);
    if (!document) {
      socket.emit('presence-error', { message: 'You do not have access to this document' });
      return;
    }

    // Ensure socket is joined to room and has documentId saved
    socket.join(documentId);
    socket.data.documentId = documentId;

    presenceService.addUser(documentId, socket.id, { name, color });

    // Tell everyone else in the room who's now active
    const activeUsers = presenceService.getActiveUsers(documentId);
    io.to(documentId).emit('presence-update', activeUsers);

    console.log(`👤 [Presence] ${name || 'Anonymous'} (${socket.id}) joined document: ${documentId}`);
  });

  // Client moves their cursor/selection
  socket.on('presence-cursor', async ({ documentId, cursor }) => {
    const targetDocId = documentId || socket.data.documentId;
    if (!targetDocId || socket.data.documentId !== targetDocId) return;

    const document = await findAccessibleDocument(targetDocId, socket.data.user);
    if (!document) return;

    // Always record the latest position internally, so a late-joining
    // user still sees the correct current cursor via presence-update.
    presenceService.updateCursor(targetDocId, socket.id, cursor);

    // But only broadcast to other clients at most every CURSOR_THROTTLE_MS,
    // so rapid typing doesn't flood the network with dozens of updates/sec.
    const now = Date.now();
    const lastSent = lastCursorBroadcast.get(socket.id) || 0;
    if (now - lastSent < CURSOR_THROTTLE_MS) return;
    lastCursorBroadcast.set(socket.id, now);

    const activeUsers = presenceService.getActiveUsers(targetDocId);
    // Broadcast to everyone else (not back to the sender)
    socket.to(targetDocId).emit('presence-update', activeUsers);
  });

  // Client explicitly leaves presence for a document
  socket.on('presence-leave', ({ documentId } = {}) => {
    const targetDocId = documentId || socket.data.documentId;
    if (!targetDocId) return;

    presenceService.removeUser(targetDocId, socket.id);
    const activeUsers = presenceService.getActiveUsers(targetDocId);
    io.to(targetDocId).emit('presence-update', activeUsers);

    console.log(`👋 [Presence] Socket ${socket.id} left presence for document: ${targetDocId}`);
  });

  // Clean up when this socket disconnects entirely
  socket.on('disconnect', () => {
    lastCursorBroadcast.delete(socket.id);

    const documentId = socket.data.documentId;
    if (!documentId) return;

    presenceService.removeUser(documentId, socket.id);
    const activeUsers = presenceService.getActiveUsers(documentId);
    io.to(documentId).emit('presence-update', activeUsers);

    console.log(`👋 [Presence] Socket ${socket.id} left document: ${documentId}`);
  });
}

module.exports = registerPresenceHandlers;

