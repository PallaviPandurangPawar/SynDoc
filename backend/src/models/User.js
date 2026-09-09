const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    avatarColor: {
      type: String,
      default: '#4A90D9', // used for presence cursor colors later
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
