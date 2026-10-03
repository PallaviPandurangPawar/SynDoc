const puppeteer = require('puppeteer');

/**
 * Converts an HTML string into a high-quality, print-styled PDF buffer using headless Chromium.
 *
 * @param {string} html - Full HTML document string
 * @param {Object} [options={}] - Custom PDF generation options
 * @param {string} [options.format='A4'] - Paper format ('A4', 'Letter', etc.)
 * @param {boolean} [options.printBackground=true] - Whether to print background colors and images
 * @param {Object} [options.margin] - Page margins in CSS units
 * @param {boolean} [options.displayHeaderFooter=true] - Whether to show header and footer
 * @param {string} [options.footerTemplate] - HTML template for footer
 * @param {string} [options.headerTemplate] - HTML template for header
 * @returns {Promise<Buffer>} PDF binary buffer
 */
async function htmlToPdf(html, options = {}) {
  if (!html || typeof html !== 'string') {
    throw new Error('htmlToPdf requires a valid HTML string');
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    });

    const page = await browser.newPage();

    // Set content and wait for styling/layout to settle
    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 10000
      });
    } catch {
      // Fallback if external resources take longer than timeout
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });
    }

        // Make sure every picture has finished loading (or failed) before printing
    try {
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images).map((img) =>
            img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; })
          )
        )
      );
    } catch {
      // printing continues even if this check cannot run
    }
    const defaultMargins = {
      top: '18mm',
      bottom: '18mm',
      left: '18mm',
      right: '18mm'
    };

    const defaultFooter = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 18mm; box-sizing: border-box;">
        <span>SynDoc PDF Export</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;

    const defaultHeader = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9px; color: #94a3b8; width: 100%; padding: 0 18mm; box-sizing: border-box;">
        <span class="title"></span>
      </div>
    `;

    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      printBackground: options.printBackground !== false,
      margin: options.margin || defaultMargins,
      displayHeaderFooter: options.displayHeaderFooter !== false,
      footerTemplate: options.footerTemplate || defaultFooter,
      headerTemplate: options.headerTemplate || defaultHeader,
      preferCSSPageSize: true
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close().catch((err) => {
        console.error('⚠️ [htmlToPdf] Error closing browser:', err.message);
      });
    }
  }
}

module.exports = {
  htmlToPdf
};
