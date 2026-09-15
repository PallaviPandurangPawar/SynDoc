// Holds a Map of documentId -> Map of nodeId -> lock info
const activeLocks = new Map();

/**
 * Attempts to lock a block (AST node) for exclusive editing by one user.
 * Returns { success: true } if the lock was acquired, or
 * { success: false, lockedBy } if someone else already holds it.
 */
function acquireLock(documentId, nodeId, socketId, userName) {
  if (!activeLocks.has(documentId)) {
    activeLocks.set(documentId, new Map());
  }

  const docLocks = activeLocks.get(documentId);
  const existing = docLocks.get(nodeId);

  if (existing && existing.socketId !== socketId) {
    return { success: false, lockedBy: existing.userName };
  }

  docLocks.set(nodeId, { socketId, userName: userName || 'Anonymous', lockedAt: new Date() });
  return { success: true };
}

/**
 * Releases a lock on a block, but only if the requesting socket actually holds it.
 */
function releaseLock(documentId, nodeId, socketId) {
  const docLocks = activeLocks.get(documentId);
  if (!docLocks) return;

  const existing = docLocks.get(nodeId);
  if (existing && existing.socketId === socketId) {
    docLocks.delete(nodeId);
  }
}

/**
 * Releases every lock held by a given socket across a document
 * (used when that socket disconnects, so locks don't get stuck forever).
 */
function releaseAllLocksForSocket(documentId, socketId) {
  const docLocks = activeLocks.get(documentId);
  if (!docLocks) return [];

  const released = [];
  for (const [nodeId, lock] of docLocks.entries()) {
    if (lock.socketId === socketId) {
      docLocks.delete(nodeId);
      released.push(nodeId);
    }
  }
  return released;
}

/**
 * Returns all currently active locks in a document, as a plain array.
 */
function getLocks(documentId) {
  const docLocks = activeLocks.get(documentId);
  if (!docLocks) return [];

  return Array.from(docLocks.entries()).map(([nodeId, lock]) => ({
    nodeId,
    userName: lock.userName,
    lockedAt: lock.lockedAt
  }));
}

module.exports = { acquireLock, releaseLock, releaseAllLocksForSocket, getLocks };