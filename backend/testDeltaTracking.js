// testDeltaTracking.js
//
// Proves the exact claim from the project plan's Mid-Project Review checkpoint:
// "Prove UI can handle incoming network deltas without corrupting local user input."
//
// This mirrors what frontend/src/hooks/useYjsSync.js does, but without React,
// so it can run head-less in the terminal.

const Y = require('yjs');

function log(msg) { console.log(msg); }

let failed = false;
function assert(condition, message) {
  if (condition) {
    log(`✅ ${message}`);
  } else {
    log(`❌ FAILED: ${message}`);
    failed = true;
  }
}

log('🚀 Starting delta tracking test (local input vs. incoming remote delta)...\n');

const localDoc = new Y.Doc();
const remoteDoc = new Y.Doc();

const localArray = localDoc.getArray('content');
const remoteArray = remoteDoc.getArray('content');

localArray.push([{ id: 'local-block', type: 'paragraph', text: 'User is typing this locally...' }]);

const localSnapshotBeforeRemoteUpdate = JSON.stringify(localArray.toArray());
log(`Local user's in-progress input: ${localSnapshotBeforeRemoteUpdate}\n`);

remoteArray.push([{ id: 'remote-block', type: 'paragraph', text: 'Another collaborator added this.' }]);

const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);

Y.applyUpdate(localDoc, remoteUpdate, 'remote');

const localAfter = localArray.toArray();
log(`Local doc content AFTER incoming remote delta: ${JSON.stringify(localAfter)}\n`);

const localBlockStillPresent = localAfter.some(
  (b) => b.id === 'local-block' && b.text === 'User is typing this locally...'
);
assert(localBlockStillPresent, 'Local in-progress input was NOT corrupted or overwritten by the incoming delta');

const remoteBlockMerged = localAfter.some(
  (b) => b.id === 'remote-block' && b.text === 'Another collaborator added this.'
);
assert(remoteBlockMerged, 'Incoming remote delta was correctly merged into the local document');

assert(localAfter.length === 2, `Local document has exactly 2 blocks after merge (got ${localAfter.length})`);

const localUpdateBack = Y.encodeStateAsUpdate(localDoc);
Y.applyUpdate(remoteDoc, localUpdateBack, 'remote');

const finalLocal = JSON.stringify(localArray.toArray());
const finalRemote = JSON.stringify(remoteArray.toArray());
assert(finalLocal === finalRemote, 'Local and remote documents converge to an identical final state');

log('\n' + (failed ? '❌ TEST FAILED — see above.' : '✅ TEST PASSED — incoming deltas merge cleanly without corrupting local input.'));
process.exit(failed ? 1 : 0);