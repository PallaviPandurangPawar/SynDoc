const Y = require('yjs');
const crdtService = require('../services/crdtService');
const syncService = require('../services/syncService');
const { getYDocs } = require('./websocket');
const { findAccessibleDocument } = require('../middlewares/documentAccess');

// Evict idle Y.Docs every 5 minutes — prevents long-running servers from
// accumulating documents in memory for documents nobody is editing anymore.
const EVICTION_INTERVAL_MS = 5 * 60 * 1000;
const IDLE_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  crdtService.evictIdleDocs(IDLE_TTL_MS);
}, EVICTION_INTERVAL_MS).unref(); // .unref() so this timer won't prevent process exit

async function persistAndRemoveIfIdle(io, documentId) {
  const room = io.sockets.adapter.rooms.get(documentId);
  if (crdtService.getSocketCount(documentId) > 0 || room?.size > 0) return;

  syncService.cancelPendingSave(documentId);
  await syncService.persistNow(documentId);

  const currentRoom = io.sockets.adapter.rooms.get(documentId);
  if (crdtService.getSocketCount(documentId) === 0 && !currentRoom?.size) {
    crdtService.removeYDoc(documentId);
  }
}

/**
 * Registers all sync-related event listeners for a single connected socket.
 */
function registerSyncHandlers(io, socket) {
  // Client asks to join a specific document's editing room
  socket.on('join-document', async (documentId) => {
    const document = await findAccessibleDocument(documentId, socket.data.user);
    if (!document) {
      socket.emit('sync-error', { message: 'You do not have access to this document' });
      return;
    }

    const previousDocumentId = socket.data.documentId;
    const previousSyncDocumentId = socket.data.syncDocumentId;

    if (previousDocumentId && previousDocumentId !== documentId) {
      socket.leave(previousDocumentId);
    }

    if (previousSyncDocumentId && previousSyncDocumentId !== documentId) {
      if (previousSyncDocumentId !== previousDocumentId) {
        socket.leave(previousSyncDocumentId);
      }
      crdtService.decrementSocketCount(previousSyncDocumentId);
      void persistAndRemoveIfIdle(io, previousSyncDocumentId);
    }

    socket.join(documentId);
    socket.data.documentId = documentId;

    // Track this socket in the per-doc counter so eviction never
    // removes a Y.Doc while someone is still editing it
    if (previousSyncDocumentId !== documentId) {
      crdtService.incrementSocketCount(documentId);
      socket.data.syncDocumentId = documentId;
    }

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
    const targetDocId = documentId || socket.data.syncDocumentId;
    if (!targetDocId || targetDocId !== socket.data.syncDocumentId) return;

    socket.leave(targetDocId);
    crdtService.decrementSocketCount(targetDocId);
    delete socket.data.syncDocumentId;
    if (socket.data.documentId === targetDocId) delete socket.data.documentId;
    console.log(`📄 [Sync] Socket ${socket.id} left document: ${targetDocId} (active sockets: ${crdtService.getSocketCount(targetDocId)})`);
    void persistAndRemoveIfIdle(io, targetDocId);
  });

  // Client sends a CRDT update (an edit they made locally)
  socket.on('sync-update', async ({ documentId, update }) => {
    if (socket.data.documentId !== documentId) return;

    const document = await findAccessibleDocument(documentId, socket.data.user);
    if (!document) return;

    const updateBytes = new Uint8Array(update);

    // Apply the update to our authoritative in-memory Y.Doc.
    // applyUpdate() also invalidates the encoded state cache.
    const applied = crdtService.applyUpdate(documentId, updateBytes);
    if (!applied) {
      socket.emit('sync-error', { message: 'Invalid document update' });
      return;
    }

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

    // Schedule a debounced save back to MongoDB
    syncService.schedulePersist(documentId);
  });

  // When this socket disconnects, check whether it was the last person
  // editing its document — if so, save immediately and free the Y.Doc from
  // memory, so long-running servers don't accumulate documents forever.
  socket.on('disconnect', () => {
    const documentId = socket.data.syncDocumentId;
    if (!documentId) return;

    crdtService.decrementSocketCount(documentId);
    void persistAndRemoveIfIdle(io, documentId);
  });
}

module.exports = registerSyncHandlers;
