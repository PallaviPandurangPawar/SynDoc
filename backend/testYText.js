// Checks that the server stores blocks as Y.Map + Y.Text and merges edits made
// inside the same block. Needs no server and no database.
const Y = require('yjs');
const crdtService = require('./src/services/crdtService');
const { sanitizeDocumentContent } = require('./src/middlewares/sanitize');

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

const DOC = 'ytext-test-doc';

// 1) Seeding from saved (MongoDB-style) blocks
crdtService.seedInitialContent(DOC, [
  { _id: 'abc', nodeId: 'n1', type: 'paragraph', content: 'middle', text: 'middle', attributes: { bold: false }, children: [] },
  { _id: 'def', nodeId: 'n2', type: 'heading', content: '', text: 'From text field', attributes: { level: 2 }, children: [] }
]);
let snapshot = crdtService.getContentSnapshot(DOC);
check('seeded block text readable', snapshot[0].content, 'middle');
check('text field used when content is empty', snapshot[1].content, 'From text field');
check('attributes kept', snapshot[1].attributes, { level: 2 });
check('duplicate "text" copy dropped', 'text' in snapshot[0], false);

// 2) Two clients join, then both type in the SAME block before seeing each other
const state = crdtService.getStateAsUpdate(DOC);
const clientA = new Y.Doc();
const clientB = new Y.Doc();
Y.applyUpdate(clientA, state);
Y.applyUpdate(clientB, state);

const textOf = (doc) => doc.getArray('content').get(0).get('content');
check('block is a Y.Map with a Y.Text on the client', textOf(clientA) instanceof Y.Text, true);

textOf(clientA).insert(0, 'START ');
textOf(clientB).insert(textOf(clientB).length, ' END');

const updateA = Y.encodeStateAsUpdate(clientA, Y.encodeStateVector(clientB));
const updateB = Y.encodeStateAsUpdate(clientB, Y.encodeStateVector(clientA));
crdtService.applyUpdate(DOC, updateA);
crdtService.applyUpdate(DOC, updateB);

snapshot = crdtService.getContentSnapshot(DOC);
check('server merged both edits inside one block', snapshot[0].content, 'START middle END');

// 3) A block added the old way (plain object) is still readable
const legacyClient = new Y.Doc();
Y.applyUpdate(legacyClient, crdtService.getStateAsUpdate(DOC));
legacyClient.getArray('content').push([{ nodeId: 'n3', type: 'paragraph', content: 'plain object block', attributes: {} }]);
crdtService.applyUpdate(DOC, Y.encodeStateAsUpdate(legacyClient));
snapshot = crdtService.getContentSnapshot(DOC);
check('legacy plain block still in snapshot', snapshot.map((b) => b.content), ['START middle END', 'From text field', 'plain object block']);

// 4) Dirty text typed into a Y.Text is cleaned before saving
Y.applyUpdate(clientA, crdtService.getStateAsUpdate(DOC));
textOf(clientA).insert(0, '<script>alert(1)</script>');
crdtService.applyUpdate(DOC, Y.encodeStateAsUpdate(clientA, Y.encodeStateVector(clientB)));
const dirty = crdtService.getContentSnapshot(DOC);
check('dirty text reached the live snapshot', dirty[0].content.includes('<script>'), true);
check('sanitizer cleans it before saving', sanitizeDocumentContent(dirty)[0].content.includes('<script>'), false);

console.log(failed === 0 ? '\n✅ ALL SERVER Y.TEXT CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);