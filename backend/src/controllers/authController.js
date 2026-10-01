const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');
const { OAuth2Client } = require('google-auth-library');

const OTP_EXPIRY_MS = 10 * 60 * 1000;   // OTP valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;   // wait 60 seconds between emails
const MAX_OTP_ATTEMPTS = 5;             // wrong guesses allowed per OTP
const RESET_EXPIRY_MS = 60 * 60 * 1000; // password reset link valid for 1 hour
const RESET_COOLDOWN_MS = 60 * 1000;    // one reset email per minute per account

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
    // Accounts created with "Continue with Google" have no real password
    if (user.authProvider === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Please use "Continue with Google".'
      });
    }
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

// POST /api/auth/google
// Receives the one-time "code" from Google's popup and checks it directly with Google.
// Then it logs the user in, creating the account if needed. No OTP is required because
// Google has already verified the email address.
const googleLogin = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Google sign-in code is missing'
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Google sign-in is not set up on the server yet'
      });
    }

    // 'postmessage' is the redirect value Google uses for its popup sign-in
    const googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage'
    );

    let payload;
    try {
      const { tokens } = await googleClient.getToken(code);
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (googleError) {
      console.error('❌ Google sign-in failed:', googleError.message);
      return res.status(401).json({
        success: false,
        message: 'Google sign-in failed. Please try again.'
      });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Your Google email address is not verified'
      });
    }

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const picture = payload.picture || '';

    let user = await User.findOne({ email });

    if (!user) {
      // New person: create the account right away (Google already verified the email)
      user = new User({
        name: (payload.name || email.split('@')[0]).trim(),
        email,
        // Nobody knows this password, so only Google sign-in can open this account
        password: crypto.randomBytes(32).toString('hex'),
        googleId,
        authProvider: 'google',
        isVerified: true,
        avatarData: picture
      });
    } else {
      if (user.googleId && user.googleId !== googleId) {
        return res.status(401).json({
          success: false,
          message: 'This email is linked to a different Google account'
        });
      }

      user.googleId = googleId;

      if (user.isVerified === false) {
        // Someone signed up with this email but never verified it. Google proves the
        // real owner is here now, so throw away the unverified password and OTP.
        user.password = crypto.randomBytes(32).toString('hex');
        user.authProvider = 'google';
        user.name = (payload.name || user.name).trim();
        user.otpHash = undefined;
        user.otpExpires = undefined;
        user.otpAttempts = 0;
        user.otpLastSentAt = undefined;
      }
      // (An already-verified password account keeps its password and gets Google as a second way in.)
      user.isVerified = true;

      // Use the Google photo only if the user has no photo yet
      if (!user.avatarData && picture) {
        user.avatarData = picture;
      }
    }

    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Signed in with Google',
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

// POST /api/auth/forgot-password
// Emails a one-time reset link. The answer is always the same, whether or not the
// email is registered, so nobody can use this form to find out who has an account.
const forgotPassword = async (req, res) => {
  const sameAnswer = {
    success: true,
    message: 'If an account with that email exists, we have sent a password reset link.'
  };

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetLastSentAt');

    if (!user) {
      return res.status(200).json(sameAnswer);
    }

    // Only one email per minute (answered silently, with the same message)
    if (user.resetLastSentAt && Date.now() - user.resetLastSentAt.getTime() < RESET_COOLDOWN_MS) {
      return res.status(200).json(sameAnswer);
    }

    // The email gets the random secret; the database only keeps a scrambled (hashed) copy
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetTokenExpires = new Date(Date.now() + RESET_EXPIRY_MS);
    user.resetLastSentAt = new Date();
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (mailError) {
      console.error('❌ Failed to send password reset email:', mailError.message);
    }

    return res.status(200).json(sameAnswer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// POST /api/auth/reset-password
// Checks the link's secret and sets the new password. The link works only once.
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Reset link and new password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Please request a new one.'
      });
    }

    user.password = password; // hashed automatically on save

    // Google-only accounts can now also log in with this password (Google still works)
    user.authProvider = 'local';

    // Receiving the email proves the address is theirs, so an unverified account becomes verified
    if (user.isVerified === false) {
      user.isVerified = true;
      user.otpHash = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      user.otpLastSentAt = undefined;
    }

    // Use up the link so it can't be used again
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    user.resetLastSentAt = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in with your new password.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = { register, verifyOtp, resendOtp, login, googleLogin, forgotPassword, resetPassword };