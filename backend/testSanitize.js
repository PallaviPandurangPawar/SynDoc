// Unit test for saved-block sanitizing. Needs no server and no database.
const { sanitizeDocumentContent, toPlainText } = require('./src/middlewares/sanitize');

let failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

// Text fields
check('script tag removed completely', toPlainText('Hello<script>alert(1)</script> world'), 'Hello world');
check('onerror image removed', toPlainText('Hi <img src=x onerror=alert(1)> there'), 'Hi  there');
check('bold tags stripped, text kept', toPlainText('<b>bold</b> text'), 'bold text');
check('plain text untouched', toPlainText('Tom & Jerry'), 'Tom & Jerry');
check('math symbols kept', toPlainText('if a < b and c > d'), 'if a < b and c > d');

// Whole blocks
const dirty = [
  { nodeId: '1', type: 'paragraph', content: 'Safe<script>steal()</script> text', text: 'Safe<script>steal()</script> text', attributes: {} },
  { nodeId: '2', type: 'code', content: '<script>console.log("this is code")</script>', attributes: { language: 'html"><script>x</script>' } },
  { nodeId: '3', type: 'image', content: '<b>cap</b>', attributes: { src: 'javascript:alert(1)', alt: '<img src=x onerror=alert(1)>' } },
  { nodeId: '4', type: 'image', content: 'ok', attributes: { src: 'https://example.com/a.png' } },
  { nodeId: '5', type: 'paragraph', content: 'link', attributes: {}, children: [
      { nodeId: '5a', type: 'text', content: '<i onmouseover=bad()>click</i>', attributes: { link: 'javascript:alert(1)' } },
      { nodeId: '5b', type: 'text', content: 'good', attributes: { link: 'https://example.com' } }
  ] }
];
const original = JSON.stringify(dirty);
const clean = sanitizeDocumentContent(dirty);

check('original input not modified', JSON.stringify(dirty), original);
check('paragraph content cleaned', clean[0].content, 'Safe text');
check('paragraph text field cleaned', clean[0].text, 'Safe text');
check('code block text kept exactly', clean[1].content, '<script>console.log("this is code")</script>');
check('code language made safe', clean[1].attributes.language, 'plaintext');
check('javascript: image src blocked', clean[2].attributes.src, '');
check('image alt cleaned', clean[2].attributes.alt, '');
check('image caption text cleaned', clean[2].content, 'cap');
check('https image src kept', clean[3].attributes.src, 'https://example.com/a.png');
check('nested text cleaned', clean[4].children[0].content, 'click');
check('javascript: link removed', clean[4].children[0].attributes.link, null);
check('https link kept', clean[4].children[1].attributes.link, 'https://example.com');

console.log(failed === 0 ? '\n✅ ALL SANITIZER CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);