// Small helpers for drawing other people's cursors.

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;

const clamp = (n, max) => Math.max(0, Math.min(Number.isFinite(n) ? n : 0, max));

/**
 * Splits a block's text around someone's cursor or selection.
 * Positions are limited to the real text length, because the text and the
 * cursor travel separately and can be a character out of step for a moment.
 */
export function splitAtCursor(text, cursor) {
  const value = typeof text === 'string' ? text : '';
  const start = clamp(cursor ? cursor.start : 0, value.length);
  const end = clamp(cursor && cursor.end !== undefined ? cursor.end : start, value.length);

  let from = Math.min(start, end);
  let to = Math.max(start, end);
  // never cut an emoji (surrogate pair) in half
  if (from > 0 && isLowSurrogate(value.charCodeAt(from)) && isHighSurrogate(value.charCodeAt(from - 1))) from--;
  if (to > 0 && isLowSurrogate(value.charCodeAt(to)) && isHighSurrogate(value.charCodeAt(to - 1))) to--;

  return { before: value.slice(0, from), selected: value.slice(from, to), after: value.slice(to) };
}

/** The other users whose cursor is inside the block with this nodeId. */
export function cursorsInBlock(users, nodeId, mySocketId) {
  return (users || []).filter(
    (u) => u.socketId !== mySocketId && u.cursor && u.cursor.nodeId === nodeId
  );
}