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

module.exports = { sendOtpEmail };