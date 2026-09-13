const mongoose = require('mongoose');
const crdtService = require('./crdtService');
const documentService = require('./documentService');
const { validateDocumentContent } = require('../middlewares/validateAST');

// Tracks a pending debounce timer per document, so rapid edits only trigger one save
const pendingSaves = new Map();
const DEBOUNCE_MS = 2000;

/**
 * Returns true if documentId is a valid MongoDB ObjectId string.
 * Non-ObjectId IDs (e.g., test slugs like "test-document-123") are intentionally
 * skipped for MongoDB operations — they're used in dev/test scenarios only.
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

/**
 * Loads a document's existing content from MongoDB into its live Yjs session.
 * Safe to call every time a user joins — only actually seeds once per document.
 */
async function loadInitialState(documentId) {
  if (crdtService.isInitialized(documentId)) return;

  // Skip MongoDB lookup for non-ObjectId IDs (e.g., dev/test slugs)
  if (!isValidObjectId(documentId)) {
    crdtService.seedInitialContent(documentId, []);
    return;
  }

  try {
    const document = await documentService.getDocumentById(documentId);
    const content = document ? document.content : [];
    crdtService.seedInitialContent(documentId, content);
  } catch (error) {
    console.error(`❌ [Sync] Failed to load initial state for ${documentId}: ${error.message}`);
    crdtService.seedInitialContent(documentId, []);
  }
}

/**
 * Immediately validates and saves the current live CRDT content to MongoDB.
 */
async function persistNow(documentId) {
  // Skip MongoDB persistence for non-ObjectId IDs (e.g., dev/test slugs)
  if (!isValidObjectId(documentId)) {
    return;
  }

  try {
    const content = crdtService.getContentSnapshot(documentId);
    validateDocumentContent(content);
    await documentService.patchDocumentContent(documentId, content);
    console.log(`💾 [Sync] Persisted document ${documentId} to MongoDB`);
  } catch (error) {
    console.error(`❌ [Sync] Failed to persist document ${documentId}: ${error.message}`);
  }
}

/**
 * Schedules a debounced save — if called again before DEBOUNCE_MS passes,
 * the previous pending save is cancelled and rescheduled. Prevents saving
 * to MongoDB on every single keystroke.
 */
function schedulePersist(documentId) {
  if (pendingSaves.has(documentId)) {
    clearTimeout(pendingSaves.get(documentId));
  }

  const timer = setTimeout(() => {
    persistNow(documentId);
    pendingSaves.delete(documentId);
  }, DEBOUNCE_MS);

  pendingSaves.set(documentId, timer);
}

module.exports = { loadInitialState, persistNow, schedulePersist };
