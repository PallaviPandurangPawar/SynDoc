const nodemailer = require('nodemailer');

// Gmail sender. Credentials come from backend/.env (EMAIL_USER, EMAIL_PASS)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Sends the 6-digit verification code to the user's email
const sendOtpEmail = async (toEmail, name, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px;">
      <h2 style="margin-top: 0;">Verify your SyncDoc account</h2>
      <p>Hi ${String(name).replace(/[<>&"]/g, '')},</p>
      <p>Use this code to finish creating your account:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #f4f6f8; padding: 12px; border-radius: 6px;">${otp}</p>
      <p>This code expires in <b>10 minutes</b>.</p>
      <p style="color: #888; font-size: 12px;">If you didn't sign up for SyncDoc, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"SyncDoc" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${otp} is your SyncDoc verification code`,
    text: `Your SyncDoc verification code is ${otp}. It expires in 10 minutes.`,
    html,
  });
};

// Emails the document owner when someone requests to join by room code.
// Includes one-click Approve/Deny links — no login required to use them.
const sendJoinRequestEmail = async (ownerEmail, ownerName, documentTitle, requesterName, requesterEmail, approveUrl, rejectUrl) => {
  const clean = (s) => String(s).replace(/[<>&"]/g, '');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px;">
      <h2 style="margin-top: 0;">Request to join "${clean(documentTitle)}"</h2>
      <p>Hi ${clean(ownerName)},</p>
      <p><b>${clean(requesterName)}</b> (${clean(requesterEmail)}) wants to join your document using the room code.</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${approveUrl}" style="display:inline-block; padding: 12px 28px; margin: 0 8px; background: #2e7d32; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Approve</a>
        <a href="${rejectUrl}" style="display:inline-block; padding: 12px 28px; margin: 0 8px; background: #c62828; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Deny</a>
      </div>
      <p style="color: #888; font-size: 12px;">One click is all it takes — no need to log in to SyncDoc.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"SyncDoc" <${process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject: `${requesterName} wants to join "${documentTitle}"`,
    text: `${requesterName} (${requesterEmail}) wants to join "${documentTitle}". Approve: ${approveUrl} Deny: ${rejectUrl}`,
    html,
  });
};

// Emails a password reset link (valid for 1 hour)
const sendPasswordResetEmail = async (toEmail, name, resetUrl) => {
  const clean = (s) => String(s).replace(/[<>&"]/g, '');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px;">
      <h2 style="margin-top: 0;">Reset your SyncDoc password</h2>
      <p>Hi ${clean(name)},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${resetUrl}" style="display:inline-block; padding: 12px 28px; background: #2196ff; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Change password</a>
      </div>
      <p>This link works once and expires in <b>1 hour</b>.</p>
      <p style="color: #888; font-size: 12px;">If you didn't ask for this, you can ignore this email. Your password will not change.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"SyncDoc" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset your SyncDoc password',
    text: `Reset your SyncDoc password using this link (valid for 1 hour): ${resetUrl}`,
    html,
  });
};

module.exports = { sendOtpEmail, sendJoinRequestEmail, sendPasswordResetEmail };