const crdtService = require('../services/crdtService');
const syncService = require('../services/syncService');

/**
 * Registers all sync-related event listeners for a single connected socket.
 */
function registerSyncHandlers(io, socket) {
  // Client asks to join a specific document's editing room
  socket.on('join-document', async (documentId) => {
    socket.join(documentId);
    socket.data.documentId = documentId;

    // If this is the first person opening this document since server start,
    // load its existing content from MongoDB into the live CRDT session
    await syncService.loadInitialState(documentId);

    // Send the current CRDT state to the newly joined client, so their editor syncs up
    const currentState = crdtService.getStateAsUpdate(documentId);
    socket.emit('sync-init', currentState);

    console.log(`📄 [Sync] Socket ${socket.id} joined document: ${documentId}`);
  });

  // Client sends a CRDT update (an edit they made locally)
  socket.on('sync-update', ({ documentId, update }) => {
    // Apply the update to our authoritative in-memory Y.Doc
    const applied = crdtService.applyUpdate(documentId, new Uint8Array(update));

    // Broadcast this update to everyone else editing the same document
    socket.to(documentId).emit('sync-update', update);

    // Schedule a debounced save back to MongoDB (only if the update was valid)
    if (applied) {
      syncService.schedulePersist(documentId);
    }
  });
}

module.exports = registerSyncHandlers;
