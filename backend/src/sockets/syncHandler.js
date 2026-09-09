const crdtService = require('../services/crdtService');

/**
 * Registers all sync-related event listeners for a single connected socket.
 */
function registerSyncHandlers(io, socket) {
  // Client asks to join a specific document's editing room
  socket.on('join-document', (documentId) => {
    socket.join(documentId);
    socket.data.documentId = documentId;

    // Send the current CRDT state to the newly joined client, so their editor syncs up
    const currentState = crdtService.getStateAsUpdate(documentId);
    socket.emit('sync-init', currentState);

    console.log(`📄 [Sync] Socket ${socket.id} joined document: ${documentId}`);
  });

  // Client sends a CRDT update (an edit they made locally)
  socket.on('sync-update', ({ documentId, update }) => {
    // Apply the update to our authoritative in-memory Y.Doc
    crdtService.applyUpdate(documentId, new Uint8Array(update));

    // Broadcast this update to everyone else editing the same document
    socket.to(documentId).emit('sync-update', update);
  });
}

module.exports = registerSyncHandlers;
