require('./src/config/env');
const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');

async function runTests() {
  console.log('--- Starting SynDoc Document CRUD APIs Test Suite ---\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  const User = require('./src/models/User');
  let testUser = null;
  let testUserId = null;
  let createdDocId = null;
  let duplicatedDocId = null;

  try {
    testUser = await User.create({
      name: 'Collab Tester',
      email: `collab_tester_${Date.now()}@syncdoc.dev`
    });
    testUserId = testUser._id.toString();
    // 1. Create Document with valid AST
    console.log('\n[1] Testing POST /api/documents (Create Document)...');
    const createRes = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CRUD Test Document',
        lastModifiedBy: 'tester@syncdoc.dev',
        ast: {
          nodeId: 'test-root',
          type: 'root',
          content: '',
          children: [
            {
              nodeId: 'p-1',
              type: 'paragraph',
              content: 'Initial paragraph in test document',
              children: []
            }
          ]
        }
      })
    });
    const createData = await createRes.json();
    console.log('Status:', createRes.status, 'Success:', createData.success);
    if (createRes.status !== 201 || !createData.success) {
      throw new Error(`Failed to create document: ${JSON.stringify(createData)}`);
    }
    createdDocId = createData.data._id;
    console.log('Created doc ID:', createdDocId);
    console.log('Doc version:', createData.data.version);
    console.log('Doc stats:', createData.data.stats);

    // 2. Test POST /api/documents validation with invalid AST
    console.log('\n[2] Testing POST /api/documents with invalid AST (Validation Middleware)...');
    const invalidAstRes = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Invalid Doc',
        ast: {
          nodeId: 'bad-node',
          type: 'unsupported_tag_foo',
          children: []
        }
      })
    });
    const invalidAstData = await invalidAstRes.json();
    console.log('Status:', invalidAstRes.status, 'Expected 400. Message:', invalidAstData.message);
    if (invalidAstRes.status !== 400) {
      throw new Error(`Expected 400 for invalid AST, got ${invalidAstRes.status}`);
    }

    // 3. Test GET /api/documents (Pagination and Listing)
    console.log('\n[3] Testing GET /api/documents (Listing with Pagination)...');
    const listRes = await fetch(`${baseUrl}/api/documents?page=1&limit=5`);
    const listData = await listRes.json();
    console.log('Status:', listRes.status, 'Total docs:', listData.pagination?.total);
    console.log('Pagination info:', listData.pagination);
    if (listRes.status !== 200 || !listData.pagination || !Array.isArray(listData.data)) {
      throw new Error(`Failed listing documents: ${JSON.stringify(listData)}`);
    }

    // 4. Test GET /api/documents/:id (Fetch Single Document)
    console.log('\n[4] Testing GET /api/documents/:id...');
    const getRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`);
    const getData = await getRes.json();
    console.log('Status:', getRes.status, 'Fetched title:', getData.data?.title);
    if (getRes.status !== 200 || getData.data?._id !== createdDocId) {
      throw new Error(`Failed to fetch document by ID`);
    }

    // 5. Test Invalid ID Handling (400 Bad Request)
    console.log('\n[5] Testing GET /api/documents/invalid-id (Malformed ID check)...');
    const malformedRes = await fetch(`${baseUrl}/api/documents/not-a-valid-id`);
    const malformedData = await malformedRes.json();
    console.log('Status:', malformedRes.status, 'Expected 400. Message:', malformedData.message);
    if (malformedRes.status !== 400) {
      throw new Error(`Expected 400 for malformed ID, got ${malformedRes.status}`);
    }

    // 6. Test PUT /api/documents/:id (Full Update)
    console.log('\n[6] Testing PUT /api/documents/:id (Full Update)...');
    const putRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated CRUD Test Document',
        lastModifiedBy: 'updater@syncdoc.dev',
        ast: {
          nodeId: 'test-root',
          type: 'root',
          children: [
            {
              nodeId: 'p-1',
              type: 'paragraph',
              content: 'Initial paragraph in test document',
              children: []
            },
            {
              nodeId: 'p-2',
              type: 'paragraph',
              content: 'Second paragraph added during PUT',
              children: []
            }
          ]
        }
      })
    });
    const putData = await putRes.json();
    console.log('Status:', putRes.status, 'Updated title:', putData.data?.title, 'New version:', putData.data?.version);
    if (putRes.status !== 200 || putData.data?.title !== 'Updated CRUD Test Document' || putData.data?.version !== 2) {
      throw new Error(`PUT update failed: ${JSON.stringify(putData)}`);
    }

    // 7. Test PATCH /api/documents/:id (Partial Update)
    console.log('\n[7] Testing PATCH /api/documents/:id (Partial Update)...');
    const patchRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Patched CRUD Document Title',
        lastModifiedBy: 'patcher@syncdoc.dev'
      })
    });
    const patchData = await patchRes.json();
    console.log('Status:', patchRes.status, 'Patched title:', patchData.data?.title, 'Version:', patchData.data?.version);
    if (patchRes.status !== 200 || patchData.data?.title !== 'Patched CRUD Document Title' || patchData.data?.version !== 3) {
      throw new Error(`PATCH update failed: ${JSON.stringify(patchData)}`);
    }

    // 8. Test GET /api/documents/:id/history (Change History)
    console.log('\n[8] Testing GET /api/documents/:id/history...');
    const historyRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/history`);
    const historyData = await historyRes.json();
    console.log('Status:', historyRes.status, 'History count:', historyData.data?.history?.length);
    console.log('History entries summary:', historyData.data?.history?.map(h => `v${h.version} [${h.action}]: ${h.summary}`));
    if (historyRes.status !== 200 || historyData.data?.history?.length < 3) {
      throw new Error(`Expected at least 3 history entries, got ${historyData.data?.history?.length}`);
    }

    // 9. Test POST /api/documents/:id/duplicate (Clone Document)
    console.log('\n[9] Testing POST /api/documents/:id/duplicate (Duplicate Document)...');
    const dupRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Custom Cloned Document',
        lastModifiedBy: 'cloner@syncdoc.dev'
      })
    });
    const dupData = await dupRes.json();
    console.log('Status:', dupRes.status, 'Duplicated title:', dupData.data?.title, 'New ID:', dupData.data?._id);
    if (dupRes.status !== 201 || dupData.data?.title !== 'Custom Cloned Document') {
      throw new Error(`Duplicate document failed: ${JSON.stringify(dupData)}`);
    }
    duplicatedDocId = dupData.data._id;

    // 10. Test Collaborators Management (POST & DELETE)
    console.log('\n[10] Testing Collaborators Management (Add & Remove)...');
    const addCollabRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: testUserId })
    });
    const addCollabData = await addCollabRes.json();
    console.log('Add collaborator status:', addCollabRes.status, 'Collaborators count:', addCollabData.data?.collaborators?.length);
    if (addCollabRes.status !== 200 || !addCollabData.data?.collaborators?.some(c => (c._id || c).toString() === testUserId)) {
      throw new Error(`Add collaborator failed`);
    }

    const removeCollabRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/collaborators/${testUserId}`, {
      method: 'DELETE'
    });
    const removeCollabData = await removeCollabRes.json();
    console.log('Remove collaborator status:', removeCollabRes.status, 'Collaborators count:', removeCollabData.data?.collaborators?.length);
    if (removeCollabRes.status !== 200 || removeCollabData.data?.collaborators?.some(c => (c._id || c).toString() === testUserId)) {
      throw new Error(`Remove collaborator failed`);
    }

    // 11. Test Search Documents
    console.log('\n[11] Testing GET /api/documents/search?q=Patched...');
    const searchRes = await fetch(`${baseUrl}/api/documents/search?q=Patched`);
    const searchData = await searchRes.json();
    console.log('Search status:', searchRes.status, 'Results count:', searchData.count);
    if (searchRes.status !== 200 || searchData.count < 1) {
      throw new Error(`Search failed: ${JSON.stringify(searchData)}`);
    }

    // 12. Test Stats
    console.log('\n[12] Testing GET /api/documents/stats...');
    const statsRes = await fetch(`${baseUrl}/api/documents/stats`);
    const statsData = await statsRes.json();
    console.log('Stats status:', statsRes.status, 'Total docs count:', statsData.data?.totalDocuments);
    if (statsRes.status !== 200 || typeof statsData.data?.totalDocuments !== 'number') {
      throw new Error(`Stats endpoint failed: ${JSON.stringify(statsData)}`);
    }

    // 13. Test DELETE /api/documents/:id
    console.log('\n[13] Testing DELETE /api/documents/:id...');
    const delRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`, {
      method: 'DELETE'
    });
    const delData = await delRes.json();
    console.log('Delete status:', delRes.status, 'Success:', delData.success);
    if (delRes.status !== 200 || !delData.success) {
      throw new Error(`Delete failed: ${JSON.stringify(delData)}`);
    }

    // Verify 404 after deletion
    const verifyDelRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`);
    console.log('Fetch after delete status:', verifyDelRes.status, 'Expected 404');
    if (verifyDelRes.status !== 404) {
      throw new Error(`Expected 404 for deleted doc, got ${verifyDelRes.status}`);
    }

    // Also delete duplicate doc
    if (duplicatedDocId) {
      await fetch(`${baseUrl}/api/documents/${duplicatedDocId}`, { method: 'DELETE' });
    }

    console.log('\n======================================================');
    console.log('🎉 ALL DOCUMENT CRUD API TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
