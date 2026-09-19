const { markdownToAst } = require('./src/utils/markdownToAst');
const { astToHtml, renderNode } = require('./src/utils/astToHtml');
const { htmlToPdf } = require('./src/utils/htmlToPdf');
const transformService = require('./src/services/transformService');
const connectDB = require('./src/config/db');
const Document = require('./src/models/Document');
const mongoose = require('mongoose');

async function runTransformationSanityChecks() {
  console.log('================================================================');
  console.log('       SynDoc: AST to PDF Transformation Engine Verification    ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, detail = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: AST to HTML Structural Mapping
  // -------------------------------------------------------------
  console.log('[1] Checking AST to Semantic HTML Generation...');
  const sampleMarkdown = `
# SynDoc Architecture
## Sub-Section Overview

This is **bold text**, *italic text*, \`inline code\`, ~~strike~~, and [Link](https://syncdoc.dev).

\`\`\`javascript
const test = "PDF Transformation";
console.log(test);
\`\`\`

- Bullet item 1
- Bullet item 2

1. Numbered one
2. Numbered two

- [x] Completed task
- [ ] Incomplete task

> Important note on transformation

---

![Logo](https://syncdoc.dev/logo.png)
`;

  const ast = markdownToAst(sampleMarkdown);
  const html = astToHtml(ast, {
    title: 'SynDoc Architecture Spec',
    author: 'Architect'
  });

  assert(html.includes('<!DOCTYPE html>'), 'HTML document has proper DOCTYPE');
  assert(html.includes('<h1 id="syndoc-architecture" class="heading heading-1">'), 'Rendered H1 with anchor ID and class');
  assert(html.includes('<h2 id="sub-section-overview" class="heading heading-2">'), 'Rendered H2 with anchor ID and class');
  assert(html.includes('<strong>bold text</strong>'), 'Rendered bold inline tag');
  assert(html.includes('<em>italic text</em>'), 'Rendered italic inline tag');
  assert(html.includes('<code class="inline-code">inline code</code>'), 'Rendered inline code tag');
  assert(html.includes('<del>strike</del>'), 'Rendered strikethrough tag');
  assert(html.includes('href="https://syncdoc.dev"'), 'Rendered anchor with href attribute');
  assert(html.includes('<pre class="code-block language-javascript">'), 'Rendered fenced code block with language');
  assert(html.includes('<ul class="bullet-list">'), 'Rendered bullet list');
  assert(html.includes('<ol class="ordered-list">'), 'Rendered ordered list');
  assert(html.includes('<ul class="task-list">'), 'Rendered task list');
  assert(html.includes('type="checkbox"') && html.includes('checked'), 'Rendered checked task item');
  assert(html.includes('<blockquote class="blockquote">'), 'Rendered blockquote');
  assert(html.includes('class="divider"'), 'Rendered divider');
  assert(html.includes('<img src="https://syncdoc.dev/logo.png"'), 'Rendered image tag');
  assert(html.includes('@media print'), 'Embedded print stylesheet');

  // -------------------------------------------------------------
  // Test 2: Security & DOMPurify Sanitization
  // -------------------------------------------------------------
  console.log('\n[2] Checking XSS Sanitization & Security...');
  const maliciousAst = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        content: 'Safe paragraph text',
        children: [
          {
            type: 'text',
            content: 'Safe paragraph text. ',
            attributes: {}
          },
          {
            type: 'text',
            content: 'Malicious link',
            attributes: { link: 'javascript:alert(1)' }
          }
        ]
      }
    ]
  };
  const sanitizedHtml = astToHtml(maliciousAst, { title: 'Security Test' });
  assert(!sanitizedHtml.includes('<script>'), 'Stripped/escaped malicious <script> tags');
  assert(!sanitizedHtml.includes('javascript:alert'), 'DOMPurify stripped dangerous javascript: URI');
  assert(sanitizedHtml.includes('Safe paragraph text'), 'Retained safe paragraph text');

  // -------------------------------------------------------------
  // Test 3: Puppeteer Headless PDF Generation
  // -------------------------------------------------------------
  console.log('\n[3] Testing HTML to PDF Conversion (Puppeteer)...');
  const pdfBuffer = await htmlToPdf(html, {
    format: 'A4',
    printBackground: true
  });

  assert(Buffer.isBuffer(pdfBuffer), 'Result is a Node Buffer');
  assert(pdfBuffer.length > 5000, `Generated PDF has substantial size (${pdfBuffer.length} bytes)`);

  const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
  assert(pdfHeader === '%PDF-', `PDF starts with valid magic bytes "%PDF-" (got: ${pdfHeader})`);

  // -------------------------------------------------------------
  // Test 4: Full Transform Service Integration with MongoDB
  // -------------------------------------------------------------
  console.log('\n[4] Testing Document Export Service with MongoDB...');
  await connectDB();

  const testDoc = new Document({
    title: 'Transform Service Test Document',
    lastModifiedBy: 'backend-test@syncdoc.dev',
    ast
  });
  await testDoc.save();

  try {
    const exportedHtmlResult = await transformService.exportDocumentAsHtml(testDoc._id);
    assert(typeof exportedHtmlResult.html === 'string', 'exportDocumentAsHtml returned HTML string');
    assert(exportedHtmlResult.title === testDoc.title, 'exportDocumentAsHtml returned correct title');

    const exportedPdfResult = await transformService.exportDocumentAsPdf(testDoc._id);
    assert(Buffer.isBuffer(exportedPdfResult.pdfBuffer), 'exportDocumentAsPdf returned PDF buffer');
    assert(exportedPdfResult.pdfBuffer.length > 5000, 'Exported PDF buffer is non-trivial');
    assert(exportedPdfResult.filename.endsWith('.pdf'), `Generated valid filename: ${exportedPdfResult.filename}`);
  } finally {
    await Document.findByIdAndDelete(testDoc._id);
    await mongoose.connection.close();
  }

  console.log('\n================================================================');
  console.log(`  🎉 ALL TESTS PASSED: ${passedTests}/${totalTests} tests succeeded!`);
  console.log('================================================================\n');

  process.exit(0);
}

runTransformationSanityChecks().catch((err) => {
  console.error('\n❌ Transformation verification failed:', err);
  process.exit(1);
});
