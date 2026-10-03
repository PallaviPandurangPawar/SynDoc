const mongoose = require('mongoose');

/**
 * A notification delivered to one user. For now these are messages that one
 * SyncDoc user sends directly to another (by email); "system" is reserved for
 * automatic notifications (for example "your join request was approved").
 */
const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['message', 'system'],
      default: 'message'
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// The dropdown always asks: "newest notifications for this person"
NotificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);