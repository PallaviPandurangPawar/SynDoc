const Document = require('../models/Document');
const { astToHtml } = require('../utils/astToHtml');
const { htmlToPdf } = require('../utils/htmlToPdf');

/**
 * Converts an in-memory AST directly into a styled, sanitized HTML document string.
 *
 * @param {Object} ast - AST root node or children array
 * @param {Object} [options={}] - Options (title, author, lastModified, etc.)
 * @returns {string} HTML string
 */
function convertAstToHtml(ast, options = {}) {
  return astToHtml(ast, options);
}

/**
 * Converts an in-memory AST directly into a PDF binary buffer.
 *
 * @param {Object} ast - AST root node or children array
 * @param {Object} [options={}] - PDF options (format, margins, title, etc.)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function convertAstToPdf(ast, options = {}) {
  const html = astToHtml(ast, options);
  return await htmlToPdf(html, options);
}

/**
 * Loads a document by ID from MongoDB and exports its AST as styled HTML.
 *
 * @param {string} documentId - MongoDB Document ObjectId or string
 * @param {Object} [options={}] - Export options
 * @returns {Promise<{ html: string, title: string, document: Object }>}
 */
async function exportDocumentAsHtml(documentId, options = {}) {
  const doc = await Document.findById(documentId);
  if (!doc) {
    const error = new Error(`Document with ID "${documentId}" not found`);
    error.status = 404;
    throw error;
  }

  const exportOptions = {
    title: doc.title || 'Untitled Document',
    author: doc.lastModifiedBy || 'SynDoc User',
    lastModified: doc.updatedAt || doc.createdAt,
    ...options
  };

  const html = astToHtml(doc.ast, exportOptions);
  return {
    html,
    title: exportOptions.title,
    document: doc
  };
}

/**
 * Loads a document by ID from MongoDB, transforms its AST to HTML, and prints a PDF buffer.
 *
 * @param {string} documentId - MongoDB Document ObjectId or string
 * @param {Object} [options={}] - Export options
 * @returns {Promise<{ pdfBuffer: Buffer, filename: string, title: string, document: Object }>}
 */
async function exportDocumentAsPdf(documentId, options = {}) {
  const doc = await Document.findById(documentId);
  if (!doc) {
    const error = new Error(`Document with ID "${documentId}" not found`);
    error.status = 404;
    throw error;
  }

  const title = doc.title || 'Untitled Document';
  const exportOptions = {
    title,
    author: doc.lastModifiedBy || 'SynDoc User',
    lastModified: doc.updatedAt || doc.createdAt,
    ...options
  };

  const html = astToHtml(doc.ast, exportOptions);
  const pdfBuffer = await htmlToPdf(html, exportOptions);

  const sanitizedTitle = title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const filename = `${sanitizedTitle || 'document'}_export.pdf`;

  return {
    pdfBuffer,
    filename,
    title,
    document: doc
  };
}

module.exports = {
  convertAstToHtml,
  convertAstToPdf,
  exportDocumentAsHtml,
  exportDocumentAsPdf
};
