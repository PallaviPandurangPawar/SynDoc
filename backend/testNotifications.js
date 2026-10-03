// Checks the notification feature (messages sent directly to another user by email):
//  - the message reaches the recipient instantly over the socket and is saved for later,
//  - bad input is refused, tags are stripped, and nobody can touch someone else's notifications,
//  - read / delete / clear work.
// Needs the backend running (npm run dev) and MongoDB reachable.
const { io } = require('socket.io-client');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await wait(25);
  }
  return false;
}

async function runScenario({ serverUrl, sender, receiver }) {
  const out = {};

  const call = async (who, method, path, body) => {
    const res = await fetch(`${serverUrl}/api/notifications${path}`, {
      method,
      headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    let json = {};
    try { json = await res.json(); } catch (e) { /* no JSON body */ }
    return { status: res.status, body: json };
  };
  const send = (message, email) => call(sender, 'POST', '', { email: email === undefined ? receiver.email : email, message });
  const listOf = async (who) => (await call(who, 'GET', '')).body;

  // Start from an empty inbox so the numbers below are exact
  await call(receiver, 'DELETE', '');
  await call(sender, 'DELETE', '');

  // The receiver is online
  const live = [];
  const socket = io(serverUrl, { auth: { token: receiver.token } });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', (err) => reject(new Error(`Socket connection refused: ${err.message}`)));
  });
  socket.on('notification', (n) => live.push(n));

  // 1) Sending a message, with a script hidden inside it
  const sent = await send('Hello <script>alert(1)</script>there');
  out.sendWorked = sent.status === 201;
  out.arrivedInstantly = await waitFor(() => live.length === 1);
  const arrived = live[0] || {};
  out.tagsRemoved = arrived.message === 'Hello there';
  out.senderShown = Boolean(arrived.sender) && arrived.sender.email === sender.email;
  out.startsUnread = arrived.isRead === false;

  // 2) It is also saved: the receiver's list has it, the sender's list does not
  const inbox = await listOf(receiver);
  out.savedForReceiver = Array.isArray(inbox.data) && inbox.data.length === 1 && inbox.unreadCount === 1;
  out.senderInboxEmpty = (await listOf(sender)).data.length === 0;

  // 3) Bad input is refused
  out.unknownEmailRefused = (await send('Hi', 'nobody-here@example.com')).status === 404;
  out.selfMessageRefused = (await send('Hi', sender.email)).status === 400;
  out.emptyMessageRefused = (await send('   ')).status === 400;
  out.badEmailRefused = (await send('Hi', 'not-an-email')).status === 400;
  out.tooLongRefused = (await send('x'.repeat(501))).status === 400;

  // 4) Nobody else can touch the notification
  const id = inbox.data[0].id;
  out.senderCannotMarkRead = (await call(sender, 'PATCH', `/${id}/read`)).status === 404;
  out.senderCannotDelete = (await call(sender, 'DELETE', `/${id}`)).status === 404;

  // 5) Mark as read
  out.markReadWorked = (await call(receiver, 'PATCH', `/${id}/read`)).status === 200;
  out.unreadCountDropped = (await listOf(receiver)).unreadCount === 0;

  // 6) Delete
  out.deleteWorked = (await call(receiver, 'DELETE', `/${id}`)).status === 200;
  out.inboxEmptyAfterDelete = (await listOf(receiver)).data.length === 0;

  // 7) Offline delivery: the receiver disconnects, the message is waiting later
  socket.disconnect();
  await wait(200);
  await send('Sent while you were offline');
  await send('And a second one');
  const waiting = await listOf(receiver);
  out.offlineMessagesWaiting = waiting.data.length === 2 && waiting.unreadCount === 2;
  out.newestFirst = waiting.data[0] && waiting.data[0].message === 'And a second one';

  // 8) Mark all read, then clear everything
  await call(receiver, 'PATCH', '/read-all');
  out.markAllReadWorked = (await listOf(receiver)).unreadCount === 0;
  await call(receiver, 'DELETE', '');
  out.clearWorked = (await listOf(receiver)).data.length === 0;

  return out;
}

module.exports = { runScenario };

// ───────── Real run against your server and MongoDB ─────────
if (require.main === module) {
  const jwt = require('jsonwebtoken');
  const { setupTestSession, cleanupTestSession } = require('./testHelpers');
  const User = require('./src/models/User');

  (async () => {
    const session = await setupTestSession({ title: 'Notification Test' });

    const RECEIVER_EMAIL = 'syncdoc.tester2@example.com';
    let receiverUser = await User.findOne({ email: RECEIVER_EMAIL });
    if (!receiverUser) {
      receiverUser = await User.create({ name: 'Test Member', email: RECEIVER_EMAIL, password: 'test-password-123' });
    }
    const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const out = await runScenario({
      serverUrl: session.serverUrl,
      sender: { token: session.token, email: session.user.email },
      receiver: { token: sign(receiverUser), email: receiverUser.email }
    });

    const labels = {
      sendWorked: 'a message can be sent to another user by email',
      arrivedInstantly: 'the online recipient receives it instantly',
      tagsRemoved: 'tags and scripts are removed from the message',
      senderShown: 'the notification shows who sent it',
      startsUnread: 'a new notification starts as unread',
      savedForReceiver: 'it is saved in the recipient\'s list with an unread count',
      senderInboxEmpty: 'the sender does not receive their own message',
      unknownEmailRefused: 'an email with no account is refused',
      selfMessageRefused: 'sending to yourself is refused',
      emptyMessageRefused: 'an empty message is refused',
      badEmailRefused: 'an invalid email is refused',
      tooLongRefused: 'a message over 500 characters is refused',
      senderCannotMarkRead: 'someone else cannot mark it as read',
      senderCannotDelete: 'someone else cannot delete it',
      markReadWorked: 'the recipient can mark it as read',
      unreadCountDropped: 'the unread count goes down',
      deleteWorked: 'the recipient can delete it',
      inboxEmptyAfterDelete: 'the list is empty after deleting',
      offlineMessagesWaiting: 'messages sent while offline are waiting later',
      newestFirst: 'the newest message is listed first',
      markAllReadWorked: 'mark all as read works',
      clearWorked: 'clear all works'
    };
    Object.keys(labels).forEach((key) => console.log(`${out[key] ? '✅' : '❌'} ${labels[key]}`));

    const all = Object.keys(labels).every((key) => out[key]);
    console.log(all ? '\n✅ TEST PASSED — notifications work.' : '\n❌ TEST FAILED — see the ❌ lines above.');

    await cleanupTestSession(session);
    process.exit(all ? 0 : 1);
  })().catch((err) => { console.error('❌ Test crashed:', err); process.exit(1); });
}