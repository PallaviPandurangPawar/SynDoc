const crdtService = require('./crdtService');
const documentService = require('./documentService');
const { validateDocumentContent } = require('../middlewares/validateAST');

// Tracks a pending debounce timer per document, so rapid edits only trigger one save
const pendingSaves = new Map();
const DEBOUNCE_MS = 2000;

/**
 * Loads a document's existing content from MongoDB into its live Yjs session.
 * Safe to call every time a user joins — only actually seeds once per document.
 */
async function loadInitialState(documentId) {
  if (crdtService.isInitialized(documentId)) return;

  try {
    const document = await documentService.getDocumentById(documentId);
    // Convert Mongoose subdocuments to plain objects — Yjs can only store
    // plain JSON-like data, not Mongoose document class instances.
    const content = document
      ? JSON.parse(JSON.stringify(document.content))
      : [];
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

/**
 * Cancels any pending debounced save for a document. Must be called before
 * removing its Y.Doc from memory — otherwise a timer left over from an edit
 * made right before disconnect can fire later, find an empty freshly-created
 * Y.Doc, and overwrite the document's real saved content with nothing.
 */
function cancelPendingSave(documentId) {
  if (pendingSaves.has(documentId)) {
    clearTimeout(pendingSaves.get(documentId));
    pendingSaves.delete(documentId);
  }
}

module.exports = { loadInitialState, persistNow, schedulePersist, cancelPendingSave };
