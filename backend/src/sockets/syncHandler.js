const Y = require('yjs');
const crdtService = require('../services/crdtService');
const syncService = require('../services/syncService');
const { getYDocs } = require('./websocket');

// Evict idle Y.Docs every 5 minutes — prevents long-running servers from
// accumulating documents in memory for documents nobody is editing anymore.
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;
const IDLE_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  crdtService.evictIdleDocs(IDLE_TTL_MS);
}, EVICTION_INTERVAL_MS).unref(); // .unref() so this timer won't prevent process exit

/**
 * Registers all sync-related event listeners for a single connected socket.
 */
function registerSyncHandlers(io, socket) {
  // Client asks to join a specific document's editing room
  socket.on('join-document', async (documentId) => {
    socket.join(documentId);
    socket.data.documentId = documentId;

    // Track this socket in the per-doc counter so eviction never
    // removes a Y.Doc while someone is still editing it
    crdtService.incrementSocketCount(documentId);

    // If this is the first person opening this document since server start,
    // load its existing content from MongoDB into the live CRDT session
    await syncService.loadInitialState(documentId);

    // Send the current CRDT state to the newly joined client, so their editor syncs up.
    // getStateAsUpdate() returns a cached encoded update when available.
    const currentState = crdtService.getStateAsUpdate(documentId);
    socket.emit('sync-init', currentState);

    console.log(`📄 [Sync] Socket ${socket.id} joined document: ${documentId} (active sockets: ${crdtService.getSocketCount(documentId)})`);
  });

  // Client leaves the document room
  socket.on('leave-document', (documentId) => {
    const targetDocId = documentId || socket.data.documentId;
    if (targetDocId) {
      socket.leave(targetDocId);
      crdtService.decrementSocketCount(targetDocId);
      delete socket.data.documentId;
      console.log(`📄 [Sync] Socket ${socket.id} left document: ${targetDocId} (active sockets: ${crdtService.getSocketCount(targetDocId)})`);
    }
  });

  // Client sends a CRDT update (an edit they made locally)
  socket.on('sync-update', ({ documentId, update }) => {
    const updateBytes = new Uint8Array(update);

    // Apply the update to our authoritative in-memory Y.Doc.
    // applyUpdate() also invalidates the encoded state cache.
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

    crdtService.decrementSocketCount(documentId);

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
