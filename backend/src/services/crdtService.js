const Y = require('yjs');

// Holds one Y.Doc per document ID, kept in memory while at least one user is editing
const activeDocs = new Map();
// Tracks which document IDs have already been seeded with initial DB content
const initializedDocs = new Set();

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
  try {
    const yDoc = getYDoc(documentId);
    Y.applyUpdate(yDoc, updateUint8Array);
    return true;
  } catch (error) {
    console.error(`❌ [CRDT] Failed to apply update for ${documentId}: ${error.message}`);
    return false;
  }
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
  initializedDocs.delete(documentId);
  console.log(`🧹 [CRDT] Removed Y.Doc for document: ${documentId}`);
}

/**
 * Returns true if this document's Y.Doc has already been seeded with its
 * initial content from MongoDB (so we don't overwrite live edits on rejoin).
 */
function isInitialized(documentId) {
  return initializedDocs.has(documentId);
}

/**
 * Seeds a freshly-created Y.Doc with a document's existing content from MongoDB,
 * stored as a JSON string inside a shared Y.Text field called 'content'.
 * Safe to call multiple times — only seeds once per document per server run.
 */
function seedInitialContent(documentId, contentArray) {
  if (initializedDocs.has(documentId)) return;

  const yDoc = getYDoc(documentId);
  const yText = yDoc.getText('content');

  if (yText.length === 0) {
    yText.insert(0, JSON.stringify(contentArray || []));
  }

  initializedDocs.add(documentId);
  console.log(`🌱 [CRDT] Seeded initial content for document: ${documentId}`);
}

/**
 * Reads the current live content back out of a Y.Doc as a parsed AST array.
 * Returns an empty array if nothing has been seeded yet or parsing fails.
 */
function getContentSnapshot(documentId) {
  const yDoc = getYDoc(documentId);
  const yText = yDoc.getText('content');

  try {
    const raw = yText.toString();
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error(`❌ [CRDT] Failed to parse content snapshot for ${documentId}: ${error.message}`);
    return [];
  }
}

module.exports = {
  getYDoc,
  applyUpdate,
  getStateAsUpdate,
  removeYDoc,
  isInitialized,
  seedInitialContent,
  getContentSnapshot,
};
