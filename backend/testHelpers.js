// Shared setup for the socket test scripts.
// Creates (or reuses) a test user, creates a fresh test document owned by that
// user, and signs a login token with the same secret the server uses.
require('./src/config/env');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Document = require('./src/models/Document');

const SERVER_URL = process.env.TEST_SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const TEST_EMAIL = 'syncdoc.tester@example.com';

async function setupTestSession({ title = 'Test Document' } = {}) {
  await connectDB();

  let user = await User.findOne({ email: TEST_EMAIL });
  if (!user) {
    user = await User.create({
      name: 'Test User',
      email: TEST_EMAIL,
      password: 'test-password-123'
    });
  }

  const doc = await Document.create({
    title,
    owner: user._id,
    collaborators: [],
    content: []
  });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  return { user, token, documentId: doc._id.toString(), serverUrl: SERVER_URL };
}

// Opens a Socket.io connection that sends the login token
function createClient(session) {
  const client = io(session.serverUrl, { auth: { token: session.token } });
  client.on('connect_error', (err) => {
    console.error(`❌ Connection refused: ${err.message} (is the backend running? is JWT_SECRET the same?)`);
  });
  client.on('sync-error', (e) => console.error(`❌ Sync error: ${e.message}`));
  return client;
}

// Deletes the test document and closes the database connection
async function cleanupTestSession(session) {
  await Document.deleteOne({ _id: session.documentId });
  await mongoose.disconnect();
}

module.exports = { setupTestSession, createClient, cleanupTestSession, mongoose, Document };