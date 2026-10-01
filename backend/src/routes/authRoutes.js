const express = require('express');
const router = express.Router();
const { register, verifyOtp, resendOtp, login, googleLogin, forgotPassword, resetPassword } = require('../controllers/authController');

// POST /api/auth/register - creates an unverified account and emails an OTP
router.post('/register', register);

// POST /api/auth/verify-otp - checks the OTP, then logs the user in
router.post('/verify-otp', verifyOtp);

// POST /api/auth/resend-otp - emails a fresh OTP
router.post('/resend-otp', resendOtp);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/google - signs in (or signs up) with a Google account
router.post('/google', googleLogin);

// POST /api/auth/forgot-password - emails a password reset link
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password - sets a new password using the emailed link
router.post('/reset-password', resetPassword);

module.exports = router;