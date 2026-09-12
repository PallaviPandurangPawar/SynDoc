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

  console.log('Initial doc version before pre-save hook:', doc.version);

  // 3. Trigger pre-save lifecycle (Simulated create)
  console.log('\n[3] Triggering Pre-Save Lifecycle (Simulated create):');
  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  console.log('Document version after creation:', doc.version);
  console.log('Calculated stats:', doc.stats);
  console.log('Change history count:', doc.changeHistory.length);
  const initialHistory = doc.changeHistory[0];
  console.log('First history entry summary:', initialHistory?.summary);
  console.log(
    'First history insertedNodes count:',
    initialHistory?.structuralChanges?.insertedNodes?.length
  );

  if (doc.version !== 1) throw new Error('Expected version to be 1 on create');
  if (doc.stats.nodeCount !== 5)
    throw new Error(`Expected nodeCount to be 5, got ${doc.stats.nodeCount}`);
  if (doc.stats.depth !== 3) throw new Error(`Expected depth to be 3, got ${doc.stats.depth}`);
  if (!initialHistory.structuralChanges || initialHistory.structuralChanges.insertedNodes.length !== 5) {
    throw new Error('Expected 5 insertedNodes in initial structural changes');
  }
  console.log('✅ Creation change tracking passed with initial structural changes!');

  // 4. Test Update Lifecycle (Node Insertion)
  console.log('\n[4] Simulating AST Modification & Pre-Save Update Tracking (Node Insertion):');
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
  const updateHistory = doc.changeHistory[doc.changeHistory.length - 1];
  console.log('Latest history entry summary:', updateHistory?.summary);
  console.log('Structural changes in update:', updateHistory?.structuralChanges);

  if (doc.version !== 2) throw new Error('Expected version to be 2 on update');
  if (doc.stats.nodeCount !== 6)
    throw new Error(`Expected nodeCount to be 6, got ${doc.stats.nodeCount}`);
  if (!updateHistory.structuralChanges.insertedNodes.some((n) => n.nodeId === 'para-2')) {
    throw new Error('Expected para-2 in insertedNodes of structuralChanges');
  }
  console.log('✅ Update change tracking passed with inserted node diff!');

  // 5. Test Node Reparenting / Move tracking
  console.log('\n[5] Simulating Node Move / Reparenting:');
  // Move code-1 into para-1's children
  const codeNodeIndex = doc.ast.children.findIndex((c) => c.nodeId === 'code-1');
  const [codeNode] = doc.ast.children.splice(codeNodeIndex, 1);
  const para1Node = doc.ast.children.find((c) => c.nodeId === 'para-1');
  para1Node.children.push(codeNode);

  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  const moveHistory = doc.changeHistory[doc.changeHistory.length - 1];
  console.log('Document version after move:', doc.version);
  console.log('Move history summary:', moveHistory?.summary);
  console.log('Moved nodes in history:', moveHistory?.structuralChanges?.movedNodes);

  if (!moveHistory.structuralChanges.movedNodes.some((m) => m.nodeId === 'code-1' && m.toParent === 'para-1')) {
    throw new Error('Expected code-1 in movedNodes to parent para-1');
  }
  console.log('✅ Node move / reparent tracking passed!');

  // 6. Test Node Deletion tracking
  console.log('\n[6] Simulating Node Deletion:');
  const para2Index = doc.ast.children.findIndex((c) => c.nodeId === 'para-2');
  doc.ast.children.splice(para2Index, 1);

  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  const deleteHistory = doc.changeHistory[doc.changeHistory.length - 1];
  console.log('Document version after delete:', doc.version);
  console.log('Delete history summary:', deleteHistory?.summary);
  console.log('Deleted nodes in history:', deleteHistory?.structuralChanges?.deletedNodes);

  if (!deleteHistory.structuralChanges.deletedNodes.some((d) => d.nodeId === 'para-2')) {
    throw new Error('Expected para-2 in deletedNodes of structuralChanges');
  }
  console.log('✅ Node deletion tracking passed!');

  // 7. Test Node Modification (Type & Attribute change)
  console.log('\n[7] Simulating Node Type & Attribute Modification:');
  const headingNode = doc.ast.children.find((c) => c.nodeId === 'heading-1');
  headingNode.type = 'callout';
  headingNode.attributes = { calloutType: 'info' };

  await new Promise((resolve, reject) => {
    Document.preSaveDocument(doc, (err) => (err ? reject(err) : resolve()));
  });

  const modifyHistory = doc.changeHistory[doc.changeHistory.length - 1];
  console.log('Document version after modification:', doc.version);
  console.log('Modify history summary:', modifyHistory?.summary);
  console.log('Modified nodes in history:', modifyHistory?.structuralChanges?.modifiedNodes);

  if (!modifyHistory.structuralChanges.modifiedNodes.some((m) => m.nodeId === 'heading-1' && m.newType === 'callout')) {
    throw new Error('Expected heading-1 in modifiedNodes with newType callout');
  }
  console.log('✅ Node type & attribute modification tracking passed!');

  // 8. Test findNode instance method
  console.log('\n[8] Testing doc.findNode():');
  const foundNode = doc.findNode('code-1');
  console.log('Found node by ID (code-1):', foundNode?.type, 'content:', foundNode?.content);
  if (!foundNode || foundNode.type !== 'code') throw new Error('findNode failed');
  console.log('✅ findNode method passed!');

  // 9. Test Circular Reference Protection
  console.log('\n[9] Testing Circular Reference Protection:');
  const circularDoc = new Document({
    title: 'Circular Test',
    ast: {
      nodeId: 'node-A',
      type: 'root',
      children: [
        {
          nodeId: 'node-A',
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

  // 10. Test Structural Validation Middleware Utility
  console.log('\n[10] Testing validateASTStructure utility:');
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
  console.log('🎉 ALL STRUCTURAL TRACKING TESTS PASSED!');
  console.log('=========================================');
}

runVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
