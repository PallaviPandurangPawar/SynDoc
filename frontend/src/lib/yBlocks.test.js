// Run with: npm run test:yblocks   (needs no server and no database)
import * as Y from 'yjs';
import { insertBlock, applyTextDiff, addBlockToDoc, updateBlockInDoc, removeBlockFromDoc } from './yBlocks.js';

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

// Two "browsers" that exchange updates, like the real sync does
function makePair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on('update', (u, origin) => { if (origin !== 'net') Y.applyUpdate(b, u, 'net'); });
  b.on('update', (u, origin) => { if (origin !== 'net') Y.applyUpdate(a, u, 'net'); });
  return [a, b];
}
const blocksOf = (doc) => doc.getArray('content').toJSON();

// ── applyTextDiff ──
function diffResult(prev, next) {
  const doc = new Y.Doc();
  const t = doc.getText('t');
  t.insert(0, prev);
  applyTextDiff(t, next);
  return t.toString();
}
check('insert in the middle', diffResult('Hello world', 'Hello big world'), 'Hello big world');
check('delete from the end', diffResult('Hello world', 'Hello'), 'Hello');
check('replace a word', diffResult('Hello world', 'Hello there'), 'Hello there');
check('clear everything', diffResult('abc', ''), '');
check('emoji stays whole', diffResult('hi 😀', 'hi 😀😀'), 'hi 😀😀');
check('swap one emoji for another', diffResult('a😀b', 'a😎b'), 'a😎b');

// Only the changed part becomes an operation (this is the "delta")
{
  const doc = new Y.Doc();
  const t = doc.getText('t');
  t.insert(0, 'The quick brown fox');
  const before = Y.encodeStateAsUpdate(doc).length;
  let sent = 0;
  doc.on('update', (u) => { sent = u.length; });
  applyTextDiff(t, 'The quick brown fox!');
  check('typing one character sends a tiny update', sent > 0 && sent < before, true);
}

// ── Same block, two people typing at the same moment (updates cross in the network) ──
{
  const a = new Y.Doc();
  const b = new Y.Doc();
  addBlockToDoc(a, { nodeId: 'p1', type: 'paragraph', content: 'middle', attributes: {} });
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

  // both type before seeing each other's change
  updateBlockInDoc(a, { nodeId: 'p1', type: 'paragraph', content: 'START middle', attributes: {} });
  updateBlockInDoc(b, { nodeId: 'p1', type: 'paragraph', content: 'middle END', attributes: {} });

  // now the network delivers both updates
  const fromA = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
  const fromB = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
  Y.applyUpdate(b, fromA);
  Y.applyUpdate(a, fromB);

  check('A and B end with identical text', blocksOf(a)[0].content, blocksOf(b)[0].content);
  check('merged text contains BOTH edits', blocksOf(a)[0].content, 'START middle END');
}

// ── Different blocks, one heading level change + one text edit ──
{
  const [a, b] = makePair();
  addBlockToDoc(a, { nodeId: 'h1', type: 'heading', content: 'Title', attributes: { level: 1 } });
  addBlockToDoc(a, { nodeId: 'p1', type: 'paragraph', content: 'Body', attributes: {} });
  updateBlockInDoc(a, { nodeId: 'h1', type: 'heading', content: 'Title', attributes: { level: 2 } });
  updateBlockInDoc(b, { nodeId: 'p1', type: 'paragraph', content: 'Body text', attributes: {} });
  check('heading level change kept', blocksOf(b)[0].attributes.level, 2);
  check('paragraph edit kept', blocksOf(a)[1].content, 'Body text');
}

// ── Editing keeps the right block even if others add blocks before it ──
{
  const [a, b] = makePair();
  addBlockToDoc(a, { nodeId: 'p1', type: 'paragraph', content: 'one', attributes: {} });
  insertBlock(a, { nodeId: 'new', type: 'paragraph', content: 'inserted above', attributes: {} }, 0);
  updateBlockInDoc(b, { nodeId: 'p1', type: 'paragraph', content: 'one edited', attributes: {} });
  check('edit lands on the right block after an insert above it', blocksOf(a).map((x) => x.content), ['inserted above', 'one edited']);
}

// ── Delete ──
{
  const [a, b] = makePair();
  addBlockToDoc(a, { nodeId: 'x', type: 'paragraph', content: 'bye', attributes: {} });
  removeBlockFromDoc(b, 'x');
  check('block removed for everyone', [blocksOf(a).length, blocksOf(b).length], [0, 0]);
}

// ── Old plain blocks (saved before this change) still work ──
{
  const a = new Y.Doc();
  a.getArray('content').push([{ nodeId: 'old', type: 'paragraph', content: 'legacy', attributes: {} }]);
  updateBlockInDoc(a, { nodeId: 'old', type: 'paragraph', content: 'legacy edited', attributes: {} });
  check('plain block upgraded and edited', blocksOf(a)[0].content, 'legacy edited');
}

// ── Offline edits: only what the server is missing gets sent after reconnecting ──
{
  const server = new Y.Doc();
  const client = new Y.Doc();
  addBlockToDoc(server, { nodeId: 'p1', type: 'paragraph', content: 'shared', attributes: {} });
  Y.applyUpdate(client, Y.encodeStateAsUpdate(server));            // client is in sync
  updateBlockInDoc(client, { nodeId: 'p1', type: 'paragraph', content: 'shared + offline edit', attributes: {} }); // edit while offline
  addBlockToDoc(server, { nodeId: 'p2', type: 'paragraph', content: 'added by someone else', attributes: {} });    // meanwhile on the server

  const serverState = Y.encodeStateAsUpdate(server);               // what sync-init delivers on reconnect
  Y.applyUpdate(client, serverState);
  const missing = Y.encodeStateAsUpdate(client, Y.encodeStateVectorFromUpdate(serverState));
  Y.applyUpdate(server, missing);
  check('offline edit reaches the server', blocksOf(server).map((x) => x.content), ['shared + offline edit', 'added by someone else']);
  check('client and server end identical', blocksOf(client), blocksOf(server));
}

console.log(failed === 0 ? '\n✅ ALL Y.TEXT CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);