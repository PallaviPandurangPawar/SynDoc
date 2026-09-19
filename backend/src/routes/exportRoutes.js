const express = require('express');
const router = express.Router();
const { exportHtml, exportPdf } = require('../controllers/exportController');

// GET /api/export/:id/html — view the document as a web page
router.get('/:id/html', exportHtml);

// GET /api/export/:id/pdf — download the document as a PDF file
router.get('/:id/pdf', exportPdf);

module.exports = router;
