const { astToHtml } = require('../utils/astToHtml');
const { sanitizeHtml } = require('../middlewares/sanitize');
const { htmlToPdf } = require('../utils/htmlToPdf');
const documentService = require('./documentService');

/**
 * Fetches a document by ID and converts its AST content into sanitized HTML.
 * @param {string} documentId
 * @returns {Promise<{ title: string, html: string }>}
 */
async function exportAsHtml(documentId) {
  const document = await documentService.getDocumentById(documentId);

  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  // Prefer the flat content array (kept in sync with ast.children by the CRDT layer)
  const contentToRender =
    Array.isArray(document.content) && document.content.length > 0
      ? document.content
      : document.ast;

  const rawHtml = astToHtml(contentToRender);
  const cleanHtml = sanitizeHtml(rawHtml);

  return {
    title: document.title,
    html: cleanHtml,
  };
}

/**
 * Fetches a document by ID and converts its AST content all the way into a PDF buffer.
 * @param {string} documentId
 * @returns {Promise<{ title: string, pdfBuffer: Buffer }>}
 */
async function exportAsPdf(documentId) {
  const { title, html } = await exportAsHtml(documentId);
  const pdfBuffer = await htmlToPdf(html);

  return { title, pdfBuffer };
}

module.exports = { exportAsHtml, exportAsPdf };
