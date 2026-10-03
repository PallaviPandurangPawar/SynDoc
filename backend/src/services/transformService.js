const Document = require('../models/Document');
const { astToHtml } = require('../utils/astToHtml');
const { htmlToPdf } = require('../utils/htmlToPdf');
const { inlineImages } = require('../utils/imageInliner');
const { markdownToAst, astToMarkdown } = require('../utils/markdownToAst');

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
  const html = astToHtml(await inlineImages(ast), options);
  return await htmlToPdf(html, options);
}

/**
 * Parses a raw Markdown string into a SynDoc AST tree.
 * No database interaction — pure in-memory transformation.
 *
 * @param {string} markdown - Raw Markdown string
 * @returns {Object} Root ASTNode
 */
function convertMarkdownToAst(markdown) {
  return markdownToAst(markdown || '');
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

    // Pictures linked from the web are embedded, so the file works offline
  const html = astToHtml(await inlineImages(doc.ast), exportOptions);
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

    // Pictures linked from the web are downloaded by the server and embedded,
  // because the headless browser that prints the PDF is often refused by image sites
  const html = astToHtml(await inlineImages(doc.ast), exportOptions);
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

/**
 * Loads a document by ID from MongoDB and exports its AST as plain Markdown text.
 *
 * @param {string} documentId - MongoDB Document ObjectId or string
 * @returns {Promise<{ markdown: string, filename: string, title: string }>}
 */
async function exportDocumentAsMarkdown(documentId) {
  const doc = await Document.findById(documentId);
  if (!doc) {
    const error = new Error(`Document with ID "${documentId}" not found`);
    error.status = 404;
    throw error;
  }

  const title = doc.title || 'Untitled Document';
  const markdown = astToMarkdown(doc.ast);

  const sanitizedTitle = title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const filename = `${sanitizedTitle || 'document'}_export.md`;

  return { markdown, filename, title };
}

module.exports = {
  convertAstToHtml,
  convertAstToPdf,
  convertMarkdownToAst,
  exportDocumentAsHtml,
  exportDocumentAsPdf,
  exportDocumentAsMarkdown
};

