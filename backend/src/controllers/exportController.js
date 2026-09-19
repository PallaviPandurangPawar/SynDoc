const transformService = require('../services/transformService');

/**
 * GET /api/export/:id/html
 * Returns the document as a sanitized HTML page.
 */
const exportHtml = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, html } = await transformService.exportAsHtml(id);

    const fullPage = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${title}</title></head>
  <body>${html}</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(fullPage);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to export document as HTML',
    });
  }
};

/**
 * GET /api/export/:id/pdf
 * Returns the document as a downloadable PDF file.
 */
const exportPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, pdfBuffer } = await transformService.exportAsPdf(id);

    const safeFileName = (title || 'document').replace(/[^a-z0-9]/gi, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to export document as PDF',
    });
  }
};

module.exports = { exportHtml, exportPdf };
