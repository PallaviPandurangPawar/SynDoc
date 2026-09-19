const transformService = require('../services/transformService');

/**
 * Controller to handle document and AST export operations (HTML, PDF).
 */

/**
 * Exports a stored document as a downloadable PDF file.
 * GET /api/export/documents/:id/pdf
 */
async function exportDocumentPdf(req, res, next) {
  try {
    const documentId = req.params.id;
    const { format } = req.query;

    const { pdfBuffer, filename } = await transformService.exportDocumentAsPdf(
      documentId,
      { format }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Exports a stored document as styled standalone HTML.
 * GET /api/export/documents/:id/html
 */
async function exportDocumentHtml(req, res, next) {
  try {
    const documentId = req.params.id;
    const { html, title } = await transformService.exportDocumentAsHtml(documentId);

    const download = req.query.download === 'true';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (download) {
      const sanitizedTitle = (title || 'document')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizedTitle}.html"`
      );
    }

    return res.send(html);
  } catch (error) {
    next(error);
  }
}

/**
 * Converts an arbitrary AST payload in the request body directly into a PDF binary.
 * POST /api/export/pdf
 */
async function convertAstToPdf(req, res, next) {
  try {
    const { ast, title, author, format, margin } = req.body;

    if (!ast) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain an "ast" property'
      });
    }

    const pdfBuffer = await transformService.convertAstToPdf(ast, {
      title: title || 'SynDoc Document',
      author,
      format,
      margin
    });

    const sanitizedTitle = (title || 'ast_export')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizedTitle}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Converts an arbitrary AST payload in the request body directly into HTML.
 * POST /api/export/html
 */
async function convertAstToHtml(req, res, next) {
  try {
    const { ast, title, author } = req.body;

    if (!ast) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain an "ast" property'
      });
    }

    const html = transformService.convertAstToHtml(ast, {
      title: title || 'SynDoc Document',
      author
    });

    return res.json({
      success: true,
      html
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  exportDocumentPdf,
  exportDocumentHtml,
  convertAstToPdf,
  convertAstToHtml
};
