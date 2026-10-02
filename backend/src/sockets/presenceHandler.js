const presenceService = require('../services/presenceService');
const { findAccessibleDocument } = require('../middlewares/documentAccess');

// Cursor updates can arrive many times per second (every key press, every
// mouse move while selecting). To keep the network calm, each user's cursor is
// broadcast at most once per CURSOR_THROTTLE_MS, and the LAST position is always
// sent a moment later, so other people never end up seeing a stale cursor.
const CURSOR_THROTTLE_MS = 50; // at most ~20 broadcasts/sec per user
const lastCursorBroadcast = new Map(); // socketId -> time of last broadcast
const pendingCursorTimers = new Map(); // socketId -> timer for the trailing broadcast

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = '#4A90D9';
const MAX_NAME_LENGTH = 40;
const MAX_OFFSET = 100000;

/**
 * Keeps only the fields a cursor is allowed to have, with safe values, so a
 * misbehaving client cannot store or spread arbitrary data through presence.
 * Returns null when there is no cursor (for example the user left the field).
 */
function normalizeCursor(cursor) {
  if (!cursor || typeof cursor !== 'object') return null;

  const toOffset = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), MAX_OFFSET) : 0;
  };

  const clean = {};
  if (Number.isInteger(cursor.blockIndex) && cursor.blockIndex >= 0) clean.blockIndex = cursor.blockIndex;
  if (typeof cursor.nodeId === 'string' && cursor.nodeId.length <= 64) clean.nodeId = cursor.nodeId;
  if ('start' in cursor || 'end' in cursor) {
    clean.start = toOffset(cursor.start);
    clean.end = toOffset('end' in cursor ? cursor.end : cursor.start);
  }
  if ('offset' in cursor) clean.offset = toOffset(cursor.offset);

  return Object.keys(clean).length > 0 ? clean : null;
}

function cleanName(name) {
  const text = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
  return text || 'Anonymous';
}

function cleanColor(color) {
  return typeof color === 'string' && HEX_COLOR.test(color) ? color : DEFAULT_COLOR;
}

/**
 * Registers all presence-related event listeners for a single connected socket.
 */
function registerPresenceHandlers(io, socket) {
  // Client announces they've joined a document with optional user info (name/color)
  socket.on('presence-join', async ({ documentId, name, color } = {}) => {
    if (!documentId) return;
    if (socket.data.documentId && socket.data.documentId !== documentId) return;

    const document = await findAccessibleDocument(documentId, socket.data.user);
    if (!document) {
      socket.emit('presence-error', { message: 'You do not have access to this document' });
      return;
    }

    // Ensure socket is joined to room and has documentId saved
    socket.join(documentId);
    socket.data.documentId = documentId;
    // Access was verified just now, so cursor moves below don't need to ask the database again
    socket.data.presenceDocId = documentId;

    presenceService.addUser(documentId, socket.id, { name: cleanName(name), color: cleanColor(color) });

    // Tell everyone else in the room who's now active
    const activeUsers = presenceService.getActiveUsers(documentId);
    io.to(documentId).emit('presence-update', activeUsers);

    console.log(`👤 [Presence] ${cleanName(name)} (${socket.id}) joined document: ${documentId}`);
  });

  // Client moves their cursor/selection (or clears it with null)
  socket.on('presence-cursor', ({ documentId, cursor } = {}) => {
    const targetDocId = documentId || socket.data.documentId;
    if (!targetDocId || socket.data.documentId !== targetDocId) return;
    if (socket.data.presenceDocId !== targetDocId) return;

    // Always record the latest position internally, so a late-joining
    // user still sees the correct current cursor via presence-update.
    presenceService.updateCursor(targetDocId, socket.id, normalizeCursor(cursor));

    const broadcast = () => {
      pendingCursorTimers.delete(socket.id);
      lastCursorBroadcast.set(socket.id, Date.now());
      // Broadcast to everyone else (not back to the sender)
      socket.to(targetDocId).emit('presence-update', presenceService.getActiveUsers(targetDocId));
    };

    const sinceLast = Date.now() - (lastCursorBroadcast.get(socket.id) || 0);
    if (sinceLast >= CURSOR_THROTTLE_MS) {
      clearTimeout(pendingCursorTimers.get(socket.id));
      broadcast();
    } else if (!pendingCursorTimers.has(socket.id)) {
      // Too soon: send the latest position as soon as the pause is over
      pendingCursorTimers.set(socket.id, setTimeout(broadcast, CURSOR_THROTTLE_MS - sinceLast));
    }
  });

  // Client explicitly leaves presence for a document
  socket.on('presence-leave', ({ documentId } = {}) => {
    const targetDocId = documentId || socket.data.documentId;
    if (!targetDocId) return;

    presenceService.removeUser(targetDocId, socket.id);
    const activeUsers = presenceService.getActiveUsers(targetDocId);
    io.to(targetDocId).emit('presence-update', activeUsers);

    console.log(`👋 [Presence] Socket ${socket.id} left presence for document: ${targetDocId}`);
  });

  // Clean up when this socket disconnects entirely
  socket.on('disconnect', () => {
    lastCursorBroadcast.delete(socket.id);
    clearTimeout(pendingCursorTimers.get(socket.id));
    pendingCursorTimers.delete(socket.id);

    const documentId = socket.data.documentId;
    if (!documentId) return;

    presenceService.removeUser(documentId, socket.id);
    const activeUsers = presenceService.getActiveUsers(documentId);
    io.to(documentId).emit('presence-update', activeUsers);

    console.log(`👋 [Presence] Socket ${socket.id} left document: ${documentId}`);
  });
}

module.exports = registerPresenceHandlers;
module.exports.normalizeCursor = normalizeCursor;