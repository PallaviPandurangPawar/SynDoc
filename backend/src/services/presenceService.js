// Holds a Map of documentId -> Map of socketId -> presence info
const activePresence = new Map();

/**
 * Registers a user as active in a document, with an optional display name/color.
 */
function addUser(documentId, socketId, userInfo = {}) {
  if (!activePresence.has(documentId)) {
    activePresence.set(documentId, new Map());
  }
  activePresence.get(documentId).set(socketId, {
    socketId,
    name: userInfo.name || 'Anonymous',
    color: userInfo.color || '#4A90D9',
    cursor: null,
    joinedAt: new Date(),
  });
}

/**
 * Updates a user's cursor position within a document.
 */
function updateCursor(documentId, socketId, cursor) {
  const docPresence = activePresence.get(documentId);
  if (!docPresence || !docPresence.has(socketId)) return;
  docPresence.get(socketId).cursor = cursor;
}

/**
 * Removes a user from a document's presence list (e.g. on disconnect).
 */
function removeUser(documentId, socketId) {
  const docPresence = activePresence.get(documentId);
  if (!docPresence) return;
  docPresence.delete(socketId);
  if (docPresence.size === 0) {
    activePresence.delete(documentId);
  }
}

/**
 * Returns a plain array of all currently active users in a document.
 */
function getActiveUsers(documentId) {
  const docPresence = activePresence.get(documentId);
  return docPresence ? Array.from(docPresence.values()) : [];
}

module.exports = { addUser, updateCursor, removeUser, getActiveUsers };
