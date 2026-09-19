const { astToHtml } = require('./src/utils/astToHtml');
const { sanitizeHtml } = require('./src/middlewares/sanitize');

const sampleAst = [
  { type: 'heading', attributes: { level: 1 }, content: 'SyncDoc Export Test' },
  { type: 'paragraph', content: 'This is a normal paragraph.' },
  {
    type: 'list',
    attributes: { listType: 'bullet' },
    children: [
      { type: 'listItem', content: 'First item' },
      { type: 'listItem', content: 'Second item', attributes: { bold: true } },
    ],
  },
  { type: 'code', attributes: { language: 'js' }, content: 'console.log("hi")' },
];

let rawHtml = astToHtml(sampleAst);

// Simulate a malicious injection to prove sanitization works
rawHtml += '<script>alert("xss")</script><img src="x" onerror="alert(2)">';

console.log('--- RAW HTML ---');
console.log(rawHtml);

const cleanHtml = sanitizeHtml(rawHtml);

console.log('\n--- SANITIZED HTML ---');
console.log(cleanHtml);