// End-to-end check: a client sends dirty blocks over the socket; after the
// server autosaves, MongoDB must contain only the cleaned versions.
const crypto = require('crypto');
const Y = require('yjs');
const { setupTestSession, createClient, cleanupTestSession, Document } = require('./testHelpers');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const session = await setupTestSession({ title: 'Sanitize Save Test' });
  const { documentId } = session;
  const client = createClient(session);

  const state = await new Promise((resolve) => {
    client.on('connect', () => client.emit('join-document', documentId));
    client.once('sync-init', resolve);
  });

  const localDoc = new Y.Doc();
  Y.applyUpdate(localDoc, new Uint8Array(state));
  const dirtyText = 'Hello<script>alert(1)</script> world';
  localDoc.getArray('content').push([
    { nodeId: crypto.randomUUID(), type: 'paragraph', content: dirtyText, text: dirtyText, attributes: {} },
    { nodeId: crypto.randomUUID(), type: 'image', content: 'logo', attributes: { src: 'javascript:alert(1)' } }
  ]);
  client.emit('sync-update', { documentId, update: Array.from(Y.encodeStateAsUpdate(localDoc)) });
  console.log('✍️  Sent a paragraph with <script> and an image with a javascript: link.');

  await wait(500);
  client.disconnect(); // last client leaving makes the server save right away
  await wait(2500);

  const saved = await Document.findById(documentId).lean();
  const paragraph = saved.content[0] && saved.content[0].content;
  const imageSrc = saved.content[1] && saved.content[1].attributes && saved.content[1].attributes.src;
  console.log(`💾 Saved paragraph: ${JSON.stringify(paragraph)}`);
  console.log(`💾 Saved image src: ${JSON.stringify(imageSrc)}`);

  const passed = paragraph === 'Hello world' && !imageSrc;
  console.log(passed
    ? '\n✅ TEST PASSED — unsafe markup was removed before saving to MongoDB.'
    : '\n❌ TEST FAILED — unsafe content reached the database.');

  await cleanupTestSession(session);
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Test crashed:', err);
  process.exit(1);
});