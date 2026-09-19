const express = require('express');
const router = express.Router();
const {
  exportDocumentPdf,
  exportDocumentHtml,
  convertAstToPdf,
  convertAstToHtml
} = require('../controllers/exportController');

// Direct AST payload transformation endpoints
router.post('/pdf', convertAstToPdf);
router.post('/html', convertAstToHtml);

// Stored Document export endpoints
router.get('/documents/:id/pdf', exportDocumentPdf);
router.get('/documents/:id/html', exportDocumentHtml);

module.exports = router;
