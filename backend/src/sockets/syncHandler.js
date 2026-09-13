const Y = require('yjs');
const crdtService = require('../services/crdtService');
const syncService = require('../services/syncService');
const { getYDocs } = require('./websocket');

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

  // Client leaves the document room
  socket.on('leave-document', (documentId) => {
    const targetDocId = documentId || socket.data.documentId;
    if (targetDocId) {
      socket.leave(targetDocId);
      delete socket.data.documentId;
      console.log(`📄 [Sync] Socket ${socket.id} left document: ${targetDocId}`);
    }
  });

  // Client sends a CRDT update (an edit they made locally)
  socket.on('sync-update', ({ documentId, update }) => {
    const updateBytes = new Uint8Array(update);

    // Apply the update to our authoritative in-memory Y.Doc
    const applied = crdtService.applyUpdate(documentId, updateBytes);

    // Broadcast this update to everyone else editing the same document via Socket.io
    socket.to(documentId).emit('sync-update', update);

    // Also bridge this update to any WebSocket (y-websocket) clients editing this document
    try {
      const yDocs = getYDocs();
      if (yDocs && yDocs.has(documentId)) {
        const wsDoc = yDocs.get(documentId);
        Y.applyUpdate(wsDoc, updateBytes, 'socket-io');
      }
    } catch (err) {
      console.error(`❌ [Sync] Error bridging update to WebSocket: ${err.message}`);
    }

    // Schedule a debounced save back to MongoDB (only if the update was valid)
    if (applied) {
      syncService.schedulePersist(documentId);
    }
  });

  // When this socket disconnects, check whether it was the last person
  // editing its document — if so, save immediately and free the Y.Doc from
  // memory, so long-running servers don't accumulate documents forever.
  socket.on('disconnect', () => {
    const documentId = socket.data.documentId;
    if (!documentId) return;

    const room = io.sockets.adapter.rooms.get(documentId);
    const remainingUsers = room ? room.size : 0;

    if (remainingUsers === 0) {
      syncService.cancelPendingSave(documentId);
      syncService.persistNow(documentId).finally(() => {
        crdtService.removeYDoc(documentId);
      });
    }
  });
}

module.exports = registerSyncHandlers;

