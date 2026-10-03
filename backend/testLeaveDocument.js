// Checks "delete" for people who are NOT the owner of a document:
//  - they only lose the document from their OWN dashboard,
//  - the owner and everyone else keep it untouched,
//  - and when the OWNER deletes it, it still goes to the trash for everyone.
// Needs the backend running (npm run dev) and MongoDB reachable.
const jwt = require('jsonwebtoken');
const { setupTestSession, cleanupTestSession, Document } = require('./testHelpers');
const User = require('./src/models/User');

async function main() {
  const session = await setupTestSession({ title: 'Leave Document Test' });
  const { documentId, serverUrl } = session;
  const ownerToken = session.token;

  // A second person who is only a collaborator on this document
  const MEMBER_EMAIL = 'syncdoc.tester2@example.com';
  let member = await User.findOne({ email: MEMBER_EMAIL });
  if (!member) {
    member = await User.create({ name: 'Test Member', email: MEMBER_EMAIL, password: 'test-password-123' });
  }
  await Document.updateOne({ _id: documentId }, { $addToSet: { collaborators: member._id } });
  const memberToken = jwt.sign({ id: member._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const call = async (token, method, path) => {
    const res = await fetch(`${serverUrl}/api${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
    let body = {};
    try { body = await res.json(); } catch (e) { /* no JSON body */ }
    return { status: res.status, body };
  };
  const listContains = async (token) => {
    const res = await call(token, 'GET', '/documents?limit=100');
    return JSON.stringify(res.body).includes(documentId);
  };

  const results = {};

  // 1) The member "deletes" the shared document
  const leave = await call(memberToken, 'DELETE', `/documents/${documentId}`);
  results.memberCanRemoveIt = leave.status === 200 && leave.body.left === true;

  // 2) The document itself is untouched
  const after = await Document.findById(documentId).lean();
  results.documentStillExists = Boolean(after) && after.isDeleted !== true;
  results.memberNoLongerCollaborator = Boolean(after) &&
    !after.collaborators.some((id) => id.toString() === member._id.toString());
  results.ownerUnchanged = Boolean(after) && after.owner.toString() === session.user._id.toString();

  // 3) The owner still has it, in the document list too
  const ownerOpen = await call(ownerToken, 'GET', `/documents/${documentId}`);
  results.ownerStillHasAccess = ownerOpen.status === 200;
  results.ownerDashboardKeepsIt = await listContains(ownerToken);

  // 4) The member no longer sees it
  const memberOpen = await call(memberToken, 'GET', `/documents/${documentId}`);
  results.memberLostAccess = memberOpen.status === 403;
  results.memberDashboardWithoutIt = !(await listContains(memberToken));

  // 5) Someone who already left cannot delete it for everyone by trying again
  const again = await call(memberToken, 'DELETE', `/documents/${documentId}`);
  results.leftMemberCannotDeleteForAll = again.status === 403;

  // 6) When the OWNER deletes, it goes to the trash for everyone
  const ownerDelete = await call(ownerToken, 'DELETE', `/documents/${documentId}`);
  const trashed = await Document.findById(documentId).lean();
  results.ownerDeleteStillTrashes = ownerDelete.status === 200 && !ownerDelete.body.left &&
    Boolean(trashed) && trashed.isDeleted === true;

  const tick = (ok) => (ok ? '✅' : '❌');
  console.log(`${tick(results.memberCanRemoveIt)} a member who is not the owner can remove the document from their dashboard`);
  console.log(`${tick(results.documentStillExists)} the document still exists and is not deleted`);
  console.log(`${tick(results.memberNoLongerCollaborator)} only that member was removed from the collaborators`);
  console.log(`${tick(results.ownerUnchanged)} the owner is unchanged`);
  console.log(`${tick(results.ownerStillHasAccess)} the owner can still open the document`);
  console.log(`${tick(results.ownerDashboardKeepsIt)} the owner's dashboard still lists it`);
  console.log(`${tick(results.memberLostAccess)} the member can no longer open it`);
  console.log(`${tick(results.memberDashboardWithoutIt)} the member's dashboard no longer lists it`);
  console.log(`${tick(results.leftMemberCannotDeleteForAll)} someone who left cannot delete it for everyone`);
  console.log(`${tick(results.ownerDeleteStillTrashes)} when the owner deletes it, it goes to the trash`);

  const all = Object.values(results).every(Boolean);
  console.log(all ? '\n✅ TEST PASSED — removing a shared document only affects the person who removed it.'
                  : '\n❌ TEST FAILED — see the ❌ lines above.');

  await cleanupTestSession(session);
  process.exit(all ? 0 : 1);
}

main().catch((err) => { console.error('❌ Test crashed:', err); process.exit(1); });