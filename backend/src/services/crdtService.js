const Y = require('yjs');

// ─── Primary Stores ───────────────────────────────────────────────────────────

// Holds one Y.Doc per document ID, kept in memory while at least one user is editing
const activeDocs = new Map();

// Tracks which document IDs have already been seeded with initial DB content
const initializedDocs = new Set();

// ─── Cache Layers ─────────────────────────────────────────────────────────────

// Caches the last encoded Yjs state update per document.
// Invalidated whenever a new update is applied, so join-time sync
// doesn't re-encode the full Y.Doc on every new connection.
const encodedStateCache = new Map();

// Records the last time each document was accessed (read or write).
// Used to identify idle documents for TTL-based eviction.
const lastAccessedAt = new Map();

// Tracks how many sockets are currently connected to each document.
// Managed externally by syncHandler via incrementSocketCount / decrementSocketCount.
const activeSocketCount = new Map();

// ─── Cache Stats ──────────────────────────────────────────────────────────────

let _cacheHits = 0;
let _cacheMisses = 0;

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Stamps the current time as the last-accessed timestamp for a document.
 */
function _touch(documentId) {
  lastAccessedAt.set(documentId, Date.now());
}

/**
 * Discards the cached encoded state for a document so the next
 * getStateAsUpdate() call re-encodes from the live Y.Doc.
 */
function _invalidateEncodedCache(documentId) {
  encodedStateCache.delete(documentId);
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Returns the Y.Doc for a given documentId, creating a new one if it doesn't exist yet.
 */
function getYDoc(documentId) {
  if (!activeDocs.has(documentId)) {
    const yDoc = new Y.Doc();
    activeDocs.set(documentId, yDoc);
    activeSocketCount.set(documentId, 0);
    console.log(`🧩 [CRDT] Created new Y.Doc for document: ${documentId}`);
  }
  _touch(documentId);
  return activeDocs.get(documentId);
}

/**
 * Applies a binary Yjs update (received from a client) to the correct Y.Doc.
 * Invalidates the encoded state cache so the next sync-init gets fresh data.
 */
function applyUpdate(documentId, updateUint8Array) {
  try {
    const yDoc = getYDoc(documentId);
    Y.applyUpdate(yDoc, updateUint8Array);
    // Encoded cache is now stale — discard it
    _invalidateEncodedCache(documentId);
    _touch(documentId);
    return true;
  } catch (error) {
    console.error(`❌ [CRDT] Failed to apply update for ${documentId}: ${error.message}`);
    return false;
  }
}

/**
 * Returns the full current state of a Y.Doc as a binary update, used to
 * sync a newly-joined client. The result is cached between updates so
 * rapid joins don't re-encode the same unchanged document repeatedly.
 */
function getStateAsUpdate(documentId) {
  if (encodedStateCache.has(documentId)) {
    _cacheHits++;
    _touch(documentId);
    return encodedStateCache.get(documentId);
  }

  _cacheMisses++;
  const yDoc = getYDoc(documentId);
  const encoded = Y.encodeStateAsUpdate(yDoc);
  encodedStateCache.set(documentId, encoded);
  _touch(documentId);
  return encoded;
}

/**
 * Removes a Y.Doc and all associated cache entries from memory.
 * Call this when the last user leaves a document.
 */
function removeYDoc(documentId) {
  activeDocs.delete(documentId);
  initializedDocs.delete(documentId);
  encodedStateCache.delete(documentId);
  lastAccessedAt.delete(documentId);
  activeSocketCount.delete(documentId);
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
 * stored as a JSON string inside a shared Y.Array field called 'content'.
 * Safe to call multiple times — only seeds once per document per server run.
 */
function seedInitialContent(documentId, contentArray) {
  if (initializedDocs.has(documentId)) return;

  const yDoc = getYDoc(documentId);
  const yArray = yDoc.getArray('content');

  if (yArray.length === 0 && Array.isArray(contentArray) && contentArray.length > 0) {
    yArray.push(contentArray);
    // Seed counts as a write — encoded cache must reflect the new state
    _invalidateEncodedCache(documentId);
  }

  initializedDocs.add(documentId);
  console.log(`🌱 [CRDT] Seeded initial content for document: ${documentId}`);
}

/**
 * Reads the current live content back out of a Y.Doc as a plain AST array.
 * Using a Y.Array (rather than a JSON text blob) means concurrent edits from
 * multiple clients merge safely — each node stays intact, even under heavy
 * concurrent load, since Yjs never splits individual array elements.
 */
function getContentSnapshot(documentId) {
  const yDoc = getYDoc(documentId);
  const yArray = yDoc.getArray('content');
  _touch(documentId);
  return yArray.toArray();
}

// ─── Socket Counter API ───────────────────────────────────────────────────────

/**
 * Increments the connected socket count for a document.
 * Called by syncHandler when a socket joins a document room.
 */
function incrementSocketCount(documentId) {
  const current = activeSocketCount.get(documentId) || 0;
  activeSocketCount.set(documentId, current + 1);
}

/**
 * Decrements the connected socket count for a document, clamped at 0.
 * Called by syncHandler on leave-document and disconnect.
 */
function decrementSocketCount(documentId) {
  const current = activeSocketCount.get(documentId) || 0;
  activeSocketCount.set(documentId, Math.max(0, current - 1));
}

/**
 * Returns how many sockets are currently connected to a document.
 */
function getSocketCount(documentId) {
  return activeSocketCount.get(documentId) || 0;
}

// ─── TTL Eviction ─────────────────────────────────────────────────────────────

/**
 * Evicts Y.Docs that have been idle for longer than maxIdleMs AND have no
 * active sockets. This prevents long-running servers from accumulating
 * documents in memory indefinitely.
 *
 * @param {number} maxIdleMs  Maximum idle time in milliseconds (default: 10 minutes)
 */
function evictIdleDocs(maxIdleMs = 10 * 60 * 1000) {
  const now = Date.now();
  let evicted = 0;

  for (const [documentId, lastAccess] of lastAccessedAt.entries()) {
    const idleMs = now - lastAccess;
    const sockets = activeSocketCount.get(documentId) || 0;

    if (idleMs > maxIdleMs && sockets === 0) {
      removeYDoc(documentId);
      evicted++;
    }
  }

  if (evicted > 0) {
    console.log(`♻️  [CRDT] Evicted ${evicted} idle Y.Doc(s) from memory`);
  }
}

// ─── Debug / Stats ────────────────────────────────────────────────────────────

/**
 * Returns a snapshot of the current cache state for debugging.
 */
function getCacheStats() {
  const docs = [];
  for (const [docId, lastAccess] of lastAccessedAt.entries()) {
    docs.push({
      documentId: docId,
      initialized: initializedDocs.has(docId),
      encodedCached: encodedStateCache.has(docId),
      activeSockets: activeSocketCount.get(docId) || 0,
      idleSec: Math.floor((Date.now() - lastAccess) / 1000),
    });
  }

  return {
    totalActiveDocs: activeDocs.size,
    encodedStateCacheSize: encodedStateCache.size,
    cacheHits: _cacheHits,
    cacheMisses: _cacheMisses,
    hitRate: _cacheHits + _cacheMisses > 0
      ? `${(((_cacheHits / (_cacheHits + _cacheMisses)) * 100)).toFixed(1)}%`
      : 'n/a',
    docs,
  };
}

module.exports = {
  getYDoc,
  applyUpdate,
  getStateAsUpdate,
  removeYDoc,
  isInitialized,
  seedInitialContent,
  getContentSnapshot,
  // Socket counter
  incrementSocketCount,
  decrementSocketCount,
  getSocketCount,
  // Eviction & stats
  evictIdleDocs,
  getCacheStats,
};
