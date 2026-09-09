const Y = require('yjs');

// Holds one Y.Doc per document ID, kept in memory while at least one user is editing
const activeDocs = new Map();

/**
 * Returns the Y.Doc for a given documentId, creating a new one if it doesn't exist yet.
 */
function getYDoc(documentId) {
  if (!activeDocs.has(documentId)) {
    const yDoc = new Y.Doc();
    activeDocs.set(documentId, yDoc);
    console.log(`🧩 [CRDT] Created new Y.Doc for document: ${documentId}`);
  }
  return activeDocs.get(documentId);
}

/**
 * Applies a binary Yjs update (received from a client) to the correct Y.Doc.
 */
function applyUpdate(documentId, updateUint8Array) {
  const yDoc = getYDoc(documentId);
  Y.applyUpdate(yDoc, updateUint8Array);
}

/**
 * Encodes the full current state of a Y.Doc, used to sync a newly-joined client.
 */
function getStateAsUpdate(documentId) {
  const yDoc = getYDoc(documentId);
  return Y.encodeStateAsUpdate(yDoc);
}

/**
 * Removes a Y.Doc from memory (e.g. when the last user leaves).
 */
function removeYDoc(documentId) {
  activeDocs.delete(documentId);
  console.log(`🧹 [CRDT] Removed Y.Doc for document: ${documentId}`);
}

module.exports = { getYDoc, applyUpdate, getStateAsUpdate, removeYDoc };
