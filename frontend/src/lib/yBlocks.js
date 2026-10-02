// Helpers for storing editor blocks inside a shared Yjs document.
//
// Every block is a Y.Map. Its text lives in a Y.Text, so Yjs tracks individual
// typed characters (deltas) instead of replacing the whole block on every
// keystroke. Two people can then type in the same block at the same time and
// both edits survive.
import * as Y from 'yjs';

/**
 * Builds the shared (Y.Map) version of a plain block object.
 * The text starts empty on purpose: Yjs only accepts text typed into a Y.Text
 * after the block is part of the document, so insertBlock() fills it in.
 */
export function blockToYMap(block) {
  const map = new Y.Map();
  Object.entries(block).forEach(([key, value]) => {
    if (value === undefined || key === 'content') return;
    map.set(key, value);
  });
  map.set('content', new Y.Text());
  return map;
}

/** Adds a block at `index` (end of the document if left out), including its text. */
export function insertBlock(yDoc, block, index) {
  const yArray = yDoc.getArray('content');
  const at = index === undefined ? yArray.length : index;
  yDoc.transact(() => {
    yArray.insert(at, [blockToYMap(block)]);
    if (typeof block.content === 'string' && block.content) {
      yArray.get(at).get('content').insert(0, block.content);
    }
  });
}

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Changes a Y.Text so it matches `next`, touching only the part that really
 * changed (everything before and after the edit is left alone).
 */
export function applyTextDiff(yText, next) {
  const prev = yText.toString();
  if (prev === next) return;

  let start = 0;
  const shortest = Math.min(prev.length, next.length);
  while (start < shortest && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  // never cut an emoji (surrogate pair) in half
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start--;

  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (
    prevEnd > start &&
    nextEnd > start &&
    prev.charCodeAt(prevEnd - 1) === next.charCodeAt(nextEnd - 1)
  ) {
    prevEnd--;
    nextEnd--;
  }
  if (prevEnd < prev.length && isLowSurrogate(prev.charCodeAt(prevEnd))) {
    prevEnd++;
    nextEnd++;
  }

  if (prevEnd > start) yText.delete(start, prevEnd - start);
  if (nextEnd > start) yText.insert(start, next.slice(start, nextEnd));
}

/** Position of the block with this nodeId, or -1. Works for old plain blocks too. */
export function findBlockIndex(yArray, nodeId) {
  for (let i = 0; i < yArray.length; i++) {
    const item = yArray.get(i);
    const id = item instanceof Y.Map ? item.get('nodeId') : item && item.nodeId;
    if (id === nodeId) return i;
  }
  return -1;
}

export function addBlockToDoc(yDoc, block) {
  insertBlock(yDoc, block);
}

/**
 * Applies an edited block (a plain object with the same nodeId) to the shared
 * document. Text goes through a character-level diff; other fields (heading
 * level, list type, image link, ...) are replaced only if they changed.
 */
export function updateBlockInDoc(yDoc, nextBlock) {
  const yArray = yDoc.getArray('content');
  const index = findBlockIndex(yArray, nextBlock.nodeId);
  if (index === -1) return;

  yDoc.transact(() => {
    const current = yArray.get(index);

    // Blocks saved the old way (plain objects) are upgraded the first time they are edited
    if (!(current instanceof Y.Map)) {
      yArray.delete(index, 1);
      insertBlock(yDoc, nextBlock, index);
      return;
    }

    Object.entries(nextBlock).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'content') {
        const text = current.get('content');
        if (text instanceof Y.Text) {
          applyTextDiff(text, typeof value === 'string' ? value : '');
        } else {
          const fresh = new Y.Text();
          current.set('content', fresh);
          if (typeof value === 'string' && value) fresh.insert(0, value);
        }
      } else if (JSON.stringify(current.get(key)) !== JSON.stringify(value)) {
        current.set(key, value);
      }
    });
  });
}

export function removeBlockFromDoc(yDoc, nodeId) {
  const yArray = yDoc.getArray('content');
  const index = findBlockIndex(yArray, nodeId);
  if (index !== -1) yArray.delete(index, 1);
}