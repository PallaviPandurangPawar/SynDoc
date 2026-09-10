const mongoose = require('mongoose');
const { ASTNodeSchema, NODE_TYPES } = require('./src/models/ASTNode');
const Document = require('./src/models/Document');
const { validateASTStructure } = require('./src/middlewares/validateAST');

async function runVerification() {
  console.log('--- SynDoc AST & Pre-Save Change Tracking Verification ---');

  // 1. Verify schema types
  console.log('\n[1] Checking Node Types:');
  console.log('Supported node types:', NODE_TYPES);

  // 2. Build a nested recursive AST document in memory
  console.log('\n[2] Building a Multi-Level Recursive AST Document:');
  const doc = new Document({
    title: 'Collaborative Editor Spec',
    lastModifiedBy: 'engineer@syncdoc.dev',
    ast: {
      nodeId: 'root-1',
      type: 'root',
      content: '',
      children: [
        {
          nodeId: 'heading-1',
          type: 'heading',
          content: 'SyncDoc Architecture',
          attributes: { level: 1 },
          children: []
        },
        {
          nodeId: 'para-1',
          type: 'paragraph',
          content: 'SyncDoc uses an Abstract Syntax Tree for real-time document sync.',
          children: [
            {
              nodeId: 'text-1',
              type: 'text',
              content: 'It supports recursive tree modeling and conflict resolution.',
              attributes: { bold: true }
            }
          ]
        },
        {
          nodeId: 'code-1',
          type: 'code',
          content: 'const syncEngine = new YjsEngine();',
          attributes: { language: 'javascript' },
          children: []
        }
      ]
    }
  });

  // Check initial state before pre-save validation
  console.log('Initial doc version before pre-save hook:', doc.version);

  // 3. Trigger pre-save lifecycle
  console.log('\n[3] Triggering Pre-Save Lifecycle (Simulated create):');
  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  console.log('Document version after creation:', doc.version);
  console.log('Calculated stats:', doc.stats);
  console.log('Change history count:', doc.changeHistory.length);
  console.log('First history entry summary:', doc.changeHistory[0]?.summary);

  if (doc.version !== 1) throw new Error('Expected version to be 1 on create');
  if (doc.stats.nodeCount !== 5) throw new Error(`Expected nodeCount to be 5, got ${doc.stats.nodeCount}`);
  if (doc.stats.depth !== 3) throw new Error(`Expected depth to be 3, got ${doc.stats.depth}`);
  console.log('✅ Creation change tracking passed!');

  // 4. Test Update Lifecycle (simulating modification)
  console.log('\n[4] Simulating AST Modification & Pre-Save Update Tracking:');
  doc.isNew = false;
  doc.title = 'Updated Collaborative Editor Architecture';
  doc.ast.children.push({
    nodeId: 'para-2',
    type: 'paragraph',
    content: 'A new paragraph added during collaboration.',
    children: []
  });

  // Re-run pre-save hook
  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  console.log('Document version after update:', doc.version);
  console.log('Updated stats:', doc.stats);
  console.log('Change history count:', doc.changeHistory.length);
  console.log('Latest history entry summary:', doc.changeHistory[doc.changeHistory.length - 1]?.summary);

  if (doc.version !== 2) throw new Error('Expected version to be 2 on update');
  if (doc.stats.nodeCount !== 6) throw new Error(`Expected nodeCount to be 6, got ${doc.stats.nodeCount}`);
  console.log('✅ Update change tracking passed!');

  // 5. Test findNode instance method
  console.log('\n[5] Testing doc.findNode():');
  const foundNode = doc.findNode('code-1');
  console.log('Found node by ID (code-1):', foundNode?.type, 'content:', foundNode?.content);
  if (!foundNode || foundNode.type !== 'code') throw new Error('findNode failed');
  console.log('✅ findNode method passed!');

  // 6. Test Circular Reference Protection
  console.log('\n[6] Testing Circular Reference Protection:');
  const circularDoc = new Document({
    title: 'Circular Test',
    ast: {
      nodeId: 'node-A',
      type: 'root',
      children: [
        {
          nodeId: 'node-A', // Duplicate / circular ID
          type: 'paragraph',
          children: []
        }
      ]
    }
  });

  let circularCaught = false;
  try {
    await new Promise((resolve, reject) => {
      Document.preSaveDocument(circularDoc, (err) => (err ? reject(err) : resolve()));
    });
  } catch (e) {
    circularCaught = true;
    console.log('Correctly caught circular reference:', e.message);
  }
  if (!circularCaught) throw new Error('Expected circular reference to be caught!');
  console.log('✅ Circular reference protection passed!');

  // 7. Test Structural Validation Middleware Utility
  console.log('\n[7] Testing validateASTStructure utility:');
  const validResult = validateASTStructure(doc.ast);
  console.log('Valid AST result:', validResult);
  if (!validResult.valid) throw new Error('Expected valid AST to pass validation');

  const invalidTypeResult = validateASTStructure({
    nodeId: '123',
    type: 'unsupported_tag_xyz',
    children: []
  });
  console.log('Invalid type result:', invalidTypeResult);
  if (invalidTypeResult.valid) throw new Error('Expected invalid type to fail validation');
  console.log('✅ validateASTStructure passed!');

  console.log('\n=========================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('=========================================');
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
