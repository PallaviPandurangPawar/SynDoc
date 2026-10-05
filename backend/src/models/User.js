const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never return the password hash in normal queries
    },
    avatarColor: {
      type: String,
      default: '#4A90D9', // used for presence cursor colors later
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    about: {
      type: String,
      default: '',
      trim: true,
    },
    trashRetentionDays: {
      type: Number,
      default: 7,
      enum: [1, 5, 7, 10, 15, 20, 25, 30]
    },
    avatarData: {
      type: String,
      default: '', // Base64 data URL of the uploaded profile photo
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // lets many normal accounts exist without a googleId
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local', // accounts made with Continue with Google get 'google'
    },
    resetTokenHash: {
      type: String,
      select: false, // only the scrambled copy of the reset link secret is stored
    },
    resetTokenExpires: {
      type: Date,
      select: false,
    },
    resetLastSentAt: {
      type: Date,
      select: false,
    },
    isVerified: {
      type: Boolean,
    },
    otpHash: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    otpLastSentAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Hash the password before saving, but only if it was actually changed
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to check a plaintext password against the stored hash
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
