const express = require('express');
const router = express.Router();
const {
  exportDocumentPdf,
  exportDocumentHtml,
  exportDocumentMarkdown,
  convertAstToPdf,
  convertAstToHtml,
  convertMarkdownToAst
} = require('../controllers/exportController');

// ── In-memory / payload transformation endpoints ──────────────────────────────
// Convert an AST payload directly to PDF or HTML (no DB needed)
router.post('/pdf', convertAstToPdf);
router.post('/html', convertAstToHtml);

// Parse raw Markdown text → SynDoc AST tree
router.post('/markdown-to-ast', convertMarkdownToAst);

// ── Stored document export endpoints ─────────────────────────────────────────
router.get('/documents/:id/pdf', exportDocumentPdf);
router.get('/documents/:id/html', exportDocumentHtml);
router.get('/documents/:id/markdown', exportDocumentMarkdown);

module.exports = router;

