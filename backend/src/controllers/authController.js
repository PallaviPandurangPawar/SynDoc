const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail } = require('../services/emailService');

const OTP_EXPIRY_MS = 10 * 60 * 1000;   // OTP valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;   // wait 60 seconds between emails
const MAX_OTP_ATTEMPTS = 5;             // wrong guesses allowed per OTP

// Generates a signed login token for a given user ID, valid for 7 days
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Creates a random 6-digit OTP, stores its hash + expiry on the user
// (the caller must call user.save() afterwards). Returns the plain OTP.
const issueOtp = async (user) => {
  const otp = crypto.randomInt(100000, 1000000).toString();
  user.otpHash = await bcrypt.hash(otp, 10);
  user.otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date();
  return otp;
};

// Returns how many seconds are left before another OTP email may be sent
const cooldownSecondsLeft = (user) => {
  if (!user.otpLastSentAt) return 0;
  const passed = Date.now() - user.otpLastSentAt.getTime();
  return passed >= RESEND_COOLDOWN_MS ? 0 : Math.ceil((RESEND_COOLDOWN_MS - passed) / 1000);
};

// POST /api/auth/register
// Creates an UNVERIFIED account and emails a 6-digit OTP. No token is returned.
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are all required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail }).select('+otpLastSentAt');
    let isNewUser = false;

    if (user) {
      // Already verified (or an old account created before OTP existed)
      if (user.isVerified !== false) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists'
        });
      }

      // Signed up before but never verified: allow trying again
      const wait = cooldownSecondsLeft(user);
      if (wait > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${wait} seconds before requesting another code`
        });
      }
      user.name = name.trim();
      user.password = password; // re-hashed automatically on save
    } else {
      user = new User({
        name: name.trim(),
        email: cleanEmail,
        password,
        isVerified: false
      });
      isNewUser = true;
    }

    const otp = await issueOtp(user);
    await user.save();

    try {
      await sendOtpEmail(user.email, user.name, otp);
    } catch (mailError) {
      console.error('❌ Failed to send OTP email:', mailError.message);
      if (isNewUser) {
        await User.deleteOne({ _id: user._id });
      }
      return res.status(500).json({
        success: false,
        message: 'Could not send the verification email. Please check the email address and try again.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Verification code sent to your email',
      data: {
        email: user.email,
        requiresVerification: true
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// POST /api/auth/verify-otp
// Checks the OTP. If correct, marks the account verified and logs the user in.
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+otpHash +otpExpires +otpAttempts');

    if (!user || user.isVerified !== false || !user.otpHash) {
      return res.status(400).json({
        success: false,
        message: 'No pending verification for this email'
      });
    }

    if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'This code has expired. Please request a new one.'
      });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many wrong attempts. Please request a new code.'
      });
    }

    const isMatch = await bcrypt.compare(String(otp).trim(), user.otpHash);

    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();
      const left = MAX_OTP_ATTEMPTS - user.otpAttempts;
      return res.status(400).json({
        success: false,
        message: left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Too many wrong attempts. Please request a new code.'
      });
    }

    // Correct OTP: verify the account and clear the OTP data
    user.isVerified = true;
    user.otpHash = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    user.otpLastSentAt = undefined;
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// POST /api/auth/resend-otp
// Sends a fresh OTP to an unverified account (max once every 60 seconds).
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+otpLastSentAt');

    if (!user || user.isVerified !== false) {
      return res.status(400).json({
        success: false,
        message: 'No pending verification for this email'
      });
    }

    const wait = cooldownSecondsLeft(user);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${wait} seconds before requesting another code`
      });
    }

    const otp = await issueOtp(user);
    await user.save();

    try {
      await sendOtpEmail(user.email, user.name, otp);
    } catch (mailError) {
      console.error('❌ Failed to send OTP email:', mailError.message);
      return res.status(500).json({
        success: false,
        message: 'Could not send the verification email. Please try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // .select('+password') is needed since the schema hides it by default
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Block accounts that never completed email verification
    if (user.isVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first. Sign up again with this email to get a new code.',
        requiresVerification: true,
        email: user.email
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = { register, verifyOtp, resendOtp, login };