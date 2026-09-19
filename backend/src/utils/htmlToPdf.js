const puppeteer = require('puppeteer');

/**
 * Converts an HTML string into a PDF file (as a Buffer) using headless Chrome.
 * @param {string} html - the HTML content to turn into a PDF
 * @param {object} options - optional PDF settings (page size, margins, etc.)
 * @returns {Promise<Buffer>} the generated PDF file's raw bytes
 */
async function htmlToPdf(html, options = {}) {
  // Launch an invisible Chrome browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Wrap the raw HTML in a full page with some basic, readable styling
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #222; }
            h1, h2, h3, h4, h5, h6 { margin-top: 1.2em; }
            pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
            code { font-family: 'Courier New', monospace; }
            blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 16px; color: #555; }
            .callout { padding: 12px 16px; border-radius: 6px; margin: 12px 0; background: #eef; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

    // Load our HTML into the invisible browser tab
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Ask Chrome to "print" this page as a PDF and give us the file bytes
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      ...options,
    });

    return pdfBuffer;
  } finally {
    // Always close the browser, even if something went wrong above
    await browser.close();
  }
}

module.exports = { htmlToPdf };
