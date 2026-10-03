const assert = require('node:assert/strict');
const { convertAstToHtml, convertAstToPdf } = require('./src/services/transformService');

async function run() {
  const ast = {
    type: 'root',
    children: [
      {
        type: 'heading',
        content: 'Transformation Report',
        attributes: { level: 1 }
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', content: 'A clean ', attributes: {} },
          { type: 'text', content: 'AST export', attributes: { bold: true } }
        ]
      },
      {
        type: 'list',
        attributes: { listType: 'bullet' },
        children: [{ content: 'First item' }, { content: 'Second item' }]
      },
      {
        type: 'list',
        attributes: { listType: 'ordered' },
        children: [{ content: 'Step one' }, { content: 'Step two' }]
      },
      {
        type: 'code',
        content: '<script>not executable</script>',
        attributes: { language: 'javascript' }
      },
      { type: 'blockquote', content: 'Preserved as a quotation.' },
      { type: 'divider' }
    ]
  };

  const options = { title: 'Transformation Report', author: 'Backend Test' };
  const html = convertAstToHtml(ast, options);

  assert.match(html, /<h1 id="transformation-report" class="heading heading-1">/);
  assert.match(html, /<p class="paragraph">A clean <strong>AST export<\/strong><\/p>/);
  assert.match(html, /<ul class="bullet-list">[\s\S]*First item[\s\S]*Second item/);
  assert.match(html, /<ol class="ordered-list">[\s\S]*Step one[\s\S]*Step two/);
  assert.match(html, /<pre class="code-block language-javascript">/);
  assert.match(html, /&lt;script&gt;not executable&lt;\/script&gt;/);
  assert.match(html, /<blockquote class="blockquote">/);
  assert.match(html, /<hr class="divider"\s*\/?\s*>/);
  assert.doesNotMatch(html, /<script>/);

  const pdfBuffer = await convertAstToPdf(ast, {
    ...options,
    displayHeaderFooter: false
  });

  assert.ok(Buffer.isBuffer(pdfBuffer), 'PDF conversion returns a Buffer');
  assert.ok(pdfBuffer.length > 1000, 'PDF output is non-empty');
  assert.equal(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');

  console.log('AST transformation utilities passed HTML structure and PDF checks.');
}

run().catch((error) => {
  console.error('AST transformation utility test failed:', error);
  process.exitCode = 1;
});