const lockService = require('../services/lockService');
const presenceService = require('../services/presenceService');
const { findAccessibleDocument } = require('../middlewares/documentAccess');

/**
 * Registers all block-locking event listeners for a single connected socket.
 */
function registerLockHandlers(io, socket) {
  // Client wants to start editing a specific block exclusively
  socket.on('lock-block', async ({ documentId, nodeId, userName }) => {
    if (socket.data.documentId !== documentId) return;
    const document = await findAccessibleDocument(documentId, socket.data.user);
    if (!document) return;

    const result = lockService.acquireLock(documentId, nodeId, socket.id, userName);

    if (result.success) {
      presenceService.updateLockedBlock(documentId, socket.id, nodeId);
      // Tell everyone in the room (including sender) the current lock state
      io.to(documentId).emit('lock-update', lockService.getLocks(documentId));
      io.to(documentId).emit('presence-update', presenceService.getActiveUsers(documentId));
    } else {
      // Only tell the requester that the block is already locked
      socket.emit('lock-denied', { nodeId, lockedBy: result.lockedBy });
    }
  });

  // Client is done editing a block, release it
  socket.on('unlock-block', async ({ documentId, nodeId }) => {
    if (socket.data.documentId !== documentId) return;
    const document = await findAccessibleDocument(documentId, socket.data.user);
    if (!document) return;

    lockService.releaseLock(documentId, nodeId, socket.id);
    presenceService.updateLockedBlock(documentId, socket.id, null);
    io.to(documentId).emit('lock-update', lockService.getLocks(documentId));
    io.to(documentId).emit('presence-update', presenceService.getActiveUsers(documentId));
  });

  // Clean up any locks this socket was holding when it disconnects
  socket.on('disconnect', () => {
    const documentId = socket.data.documentId;
    if (!documentId) return;

    const released = lockService.releaseAllLocksForSocket(documentId, socket.id);
    if (released.length > 0) {
      io.to(documentId).emit('lock-update', lockService.getLocks(documentId));
    }
  });
}

module.exports = registerLockHandlers;