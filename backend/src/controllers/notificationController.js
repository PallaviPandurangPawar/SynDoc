const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { toPlainText } = require('../middlewares/sanitize');

const MAX_MESSAGE_LENGTH = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple spam guard: one person can send at most 15 messages per minute
const SEND_LIMIT = 15;
const SEND_WINDOW_MS = 60 * 1000;
const recentSends = new Map(); // userId -> times of recent messages

function sentTooManyRecently(userId) {
  const now = Date.now();
  const times = (recentSends.get(String(userId)) || []).filter((t) => now - t < SEND_WINDOW_MS);
  if (times.length >= SEND_LIMIT) {
    recentSends.set(String(userId), times);
    return true;
  }
  times.push(now);
  recentSends.set(String(userId), times);
  return false;
}

// The shape the frontend receives
function toClient(notification) {
  const sender = notification.sender;
  return {
    id: String(notification._id),
    type: notification.type,
    message: notification.message,
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt,
    sender: sender && typeof sender === 'object'
      ? { id: String(sender._id), name: sender.name, email: sender.email }
      : null
  };
}

// POST /api/notifications  { email, message }
const sendNotification = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    // Tags and scripts are removed, exactly like text saved inside documents
    const message = toPlainText(typeof req.body.message === 'string' ? req.body.message : '').trim();

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'Write a message first.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`
      });
    }
    if (email === String(req.user.email || '').toLowerCase()) {
      return res.status(400).json({ success: false, message: "You can't send a message to yourself." });
    }
    if (sentTooManyRecently(req.user._id)) {
      return res.status(429).json({
        success: false,
        message: 'You are sending messages too quickly. Please wait a moment.'
      });
    }

    const recipient = await User.findOne({ email }).select('_id name email');
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'No SyncDoc user found with that email.' });
    }

    const created = await Notification.create({
      recipient: recipient._id,
      sender: req.user._id,
      type: 'message',
      message
    });

    // Deliver it instantly if the person is online (they also get it from the database next time)
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${recipient._id}`).emit(
        'notification',
        toClient({
          _id: created._id,
          type: created.type,
          message: created.message,
          isRead: false,
          createdAt: created.createdAt,
          sender: { _id: req.user._id, name: req.user.name, email: req.user.email }
        })
      );
    }

    return res.status(201).json({
      success: true,
      message: `Message sent to ${recipient.name}.`,
      data: { id: String(created._id), recipientName: recipient.name }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// GET /api/notifications?limit=50
const listNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    const items = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'name email');
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    return res.status(200).json({ success: true, data: items.map(toClient), unreadCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }
    // The recipient filter means nobody can touch someone else's notification
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }
    const result = await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// DELETE /api/notifications  (clears everything for the logged-in user)
const clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = {
  sendNotification,
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  clearNotifications
};