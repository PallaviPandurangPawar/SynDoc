const { markdownToAst, astToMarkdown } = require('./src/utils/markdownToAst');
const { validateASTStructure } = require('./src/middlewares/validateAST');
const Document = require('./src/models/Document');

/**
 * Suite of Sanity Checks for Markdown-to-JSON (AST) Mapping
 */
async function runMarkdownMappingSanityChecks() {
  console.log('================================================================');
  console.log('       SynDoc: Markdown to JSON (AST) Sanity Checks Suite       ');
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
      throw new Error(`Sanity check failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Heading Nodes Sanity Check (H1 through H6)
  // -------------------------------------------------------------
  console.log('[1] Checking Headings Mapping (H1 - H6)...');
  const markdownHeadings = `
# Title Level 1
## Section Level 2
### Subsection Level 3
#### Deep Level 4
##### Minor Level 5
###### Micro Level 6
`;
  const headingAst = markdownToAst(markdownHeadings);
  assert(headingAst.type === 'root', 'Heading AST root type is "root"');
  assert(headingAst.children.length === 6, 'All 6 headings mapped to children');

  for (let i = 0; i < 6; i++) {
    const node = headingAst.children[i];
    const expectedLevel = i + 1;
    assert(node.type === 'heading', `Node ${i + 1} is type "heading"`);
    assert(
      (node.attributes && node.attributes.level === expectedLevel) ||
        (node.attrs && node.attrs.level === expectedLevel),
      `Heading ${i + 1} has level ${expectedLevel}`
    );
    assert(node.content.includes(`Level ${expectedLevel}`), `Heading ${i + 1} preserves content`);
  }

  const headingValidation = validateASTStructure(headingAst);
  assert(headingValidation.valid, 'Headings AST passes validateASTStructure()');

  // -------------------------------------------------------------
  // Test 2: Inline Formatting Sanity Check (bold, italic, code, link)
  // -------------------------------------------------------------
  console.log('\n[2] Checking Inline Formatting Mapping...');
  const inlineMarkdown = 'This is **bold text**, *italic text*, `code snippet`, ~~deleted~~, and a [SynDoc Link](https://syncdoc.dev).';
  const inlineAst = markdownToAst(inlineMarkdown);
  const paraNode = inlineAst.children[0];

  assert(paraNode.type === 'paragraph', 'Parent block is a paragraph');
  assert(Array.isArray(paraNode.children), 'Paragraph has inline children');

  const hasBold = paraNode.children.some((c) => c.content === 'bold text' && c.attributes.bold === true);
  const hasItalic = paraNode.children.some((c) => c.content === 'italic text' && c.attributes.italic === true);
  const hasCode = paraNode.children.some((c) => c.content === 'code snippet' && c.attributes.code === true);
  const hasStrike = paraNode.children.some((c) => c.content === 'deleted' && c.attributes.strikethrough === true);
  const hasLink = paraNode.children.some(
    (c) => c.content === 'SynDoc Link' && c.attributes.link === 'https://syncdoc.dev'
  );

  assert(hasBold, 'Parsed inline bold element');
  assert(hasItalic, 'Parsed inline italic element');
  assert(hasCode, 'Parsed inline code element');
  assert(hasStrike, 'Parsed inline strikethrough element');
  assert(hasLink, 'Parsed inline link with correct href attribute');

  const inlineValidation = validateASTStructure(inlineAst);
  assert(inlineValidation.valid, 'Inline AST passes validateASTStructure()');

  // -------------------------------------------------------------
  // Test 3: Fenced Code Blocks & Language Preservation
  // -------------------------------------------------------------
  console.log('\n[3] Checking Fenced Code Block Mapping...');
  const codeMarkdown = `\`\`\`javascript
const socket = io('http://localhost:5000');
socket.emit('join-document', { docId: 'doc-123' });
\`\`\``;
  const codeAst = markdownToAst(codeMarkdown);
  const codeNode = codeAst.children[0];

  assert(codeNode.type === 'code', 'Block mapped to type "code"');
  assert(codeNode.attributes.language === 'javascript', 'Preserved language attribute "javascript"');
  assert(codeNode.content.includes('join-document'), 'Preserved code block body');

  const codeValidation = validateASTStructure(codeAst);
  assert(codeValidation.valid, 'Code AST passes validateASTStructure()');

  // -------------------------------------------------------------
  // Test 4: Lists Mapping (Unordered, Ordered, Task / Checklist)
  // -------------------------------------------------------------
  console.log('\n[4] Checking Lists Mapping...');
  const listMarkdown = `
- Bullet item 1
- Bullet item 2

1. First step
2. Second step

- [x] Finished feature
- [ ] Upcoming release
`;
  const listAst = markdownToAst(listMarkdown);
  assert(listAst.children.length === 3, 'Found 3 distinct list blocks');

  const [bulletList, orderedList, checkList] = listAst.children;

  assert(bulletList.attributes.listType === 'bullet', 'First list is bullet list');
  assert(bulletList.children.length === 2, 'Bullet list has 2 items');

  assert(orderedList.attributes.listType === 'ordered', 'Second list is ordered list');
  assert(orderedList.children.length === 2, 'Ordered list has 2 items');

  assert(checkList.attributes.listType === 'check', 'Third list is checklist');
  assert(checkList.children[0].attributes.checked === true, 'Task 1 is checked (true)');
  assert(checkList.children[1].attributes.checked === false, 'Task 2 is unchecked (false)');

  const mixedListAst = markdownToAst('- Bullet item\n1. Ordered item\n- [x] Finished\n- [ ] Upcoming');
  assert(mixedListAst.children.length === 3, 'Adjacent mixed list types remain separate blocks');
  assert(mixedListAst.children[0].attributes.listType === 'bullet', 'Mixed input preserves bullet list type');
  assert(mixedListAst.children[1].attributes.listType === 'ordered', 'Mixed input preserves ordered list type');
  assert(mixedListAst.children[2].attributes.listType === 'check', 'Mixed input preserves checklist type');
  assert(
    astToMarkdown(mixedListAst) === '- Bullet item\n\n1. Ordered item\n\n- [x] Finished\n- [ ] Upcoming',
    'Mixed list types survive Markdown export'
  );

  const listValidation = validateASTStructure(listAst);
  assert(listValidation.valid, 'Lists AST passes validateASTStructure()');

  // -------------------------------------------------------------
  // Test 5: Blockquotes, Dividers & Images Mapping
  // -------------------------------------------------------------
  console.log('\n[5] Checking Blockquotes, Dividers & Images...');
  const miscMarkdown = `
> System design quote for AST synchronization

---

![SynDoc Logo](https://syncdoc.dev/logo.png)
`;
  const miscAst = markdownToAst(miscMarkdown);
  assert(miscAst.children.length === 3, 'Mapped 3 block nodes');

  const quoteNode = miscAst.children[0];
  const dividerNode = miscAst.children[1];
  const imageNode = miscAst.children[2];

  assert(quoteNode.type === 'blockquote', 'Mapped blockquote node');
  assert(dividerNode.type === 'divider', 'Mapped divider node');
  assert(imageNode.type === 'image', 'Mapped image node');
  assert(imageNode.attributes.src === 'https://syncdoc.dev/logo.png', 'Image src attribute preserved');
  assert(imageNode.attributes.alt === 'SynDoc Logo', 'Image alt attribute preserved');

  const miscValidation = validateASTStructure(miscAst);
  assert(miscValidation.valid, 'Misc AST passes validateASTStructure()');

  // -------------------------------------------------------------
  // Test 6: Round-Trip Conversion Fidelity (Markdown -> AST -> Markdown)
  // -------------------------------------------------------------
  console.log('\n[6] Checking Bidirectional Round-Trip Fidelity...');
  const sampleDoc = `# SynDoc Overview

Collaborative editing with **CRDT**.

\`\`\`javascript
console.log('CRDT Active');
\`\`\`

- [x] AST Verified
`;
  const roundTripAst = markdownToAst(sampleDoc);
  const regeneratedMd = astToMarkdown(roundTripAst);

  assert(regeneratedMd.includes('# SynDoc Overview'), 'Round-trip contains heading');
  assert(regeneratedMd.includes('**CRDT**'), 'Round-trip preserves bold');
  assert(regeneratedMd.includes('```javascript'), 'Round-trip preserves code fence');
  assert(regeneratedMd.includes('- [x] AST Verified'), 'Round-trip preserves checklist item');

  // -------------------------------------------------------------
  // Test 7: Mongoose Document Lifecycle & Metrics Calculation
  // -------------------------------------------------------------
  console.log('\n[7] Testing Mongoose Document Integration & Pre-Save Lifecycle...');
  const fullDocMarkdown = `
# Real-Time Collaborative Architecture

SynDoc coordinates distributed clients using **Yjs CRDT** and **AST Trees**.

\`\`\`json
{ "status": "active", "version": 1 }
\`\`\`

- [x] AST Schema Designed
- [x] Socket Handlers Mounted
- [ ] Production Deployment
`;
  const documentAst = markdownToAst(fullDocMarkdown);

  const doc = new Document({
    title: 'Collaborative Markdown Specification',
    lastModifiedBy: 'architect@syncdoc.dev',
    ast: documentAst
  });

  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  assert(doc.version === 1, 'Initial document version is 1');
  assert(doc.stats.nodeCount > 5, `Node count accurately computed (${doc.stats.nodeCount} nodes)`);
  assert(doc.stats.wordCount > 10, `Word count accurately computed (${doc.stats.wordCount} words)`);
  assert(doc.stats.depth >= 2, `AST depth accurately calculated (depth: ${doc.stats.depth})`);
  assert(doc.changeHistory.length === 1, 'Change history audit trail initiated');
  assert(doc.changeHistory[0].action === 'CREATE', 'Change history recorded CREATE action');
  assert(
    doc.changeHistory[0].structuralChanges.insertedNodes.length > 0,
    'Structural changes tracked initial node insertions'
  );

  console.log('\n================================================================');
  console.log(`  🎉 ALL SANITY CHECKS PASSED: ${passedTests}/${totalTests} tests succeeded!`);
  console.log('================================================================\n');

  process.exit(0);
}

runMarkdownMappingSanityChecks().catch((err) => {
  console.error('\n❌ Sanity checks failed:', err);
  process.exit(1);
});
