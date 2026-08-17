const nodemailer = require('nodemailer');
require('dotenv').config();

// Create SMTP Transporter
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  // Return null if not configured, fallback to console log logging transport
  return null;
};

/**
 * Send Account Credentials email notification
 * @param {Object} params
 * @param {string} params.email - Recipient email address
 * @param {string} params.fullName - Full name of the user
 * @param {string} params.username - Account username
 * @param {string} params.tempPassword - Generated temporary password
 * @param {boolean} params.isReset - True if password reset, false if account creation
 */
async function sendAccountCredentialsEmail({ email, fullName, username, tempPassword, isReset = false }) {
  const subject = 'Your Account Credentials';
  const actionText = isReset
    ? 'Your account password has been reset by the system administrator.'
    : 'Your new account has been created by the system administrator.';

  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173/login';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
        .header p { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }
        .content { padding: 28px 24px; }
        .cred-box { background-color: #f1f5f9; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px; margin: 20px 0; }
        .cred-item { margin-bottom: 8px; font-size: 14px; }
        .cred-item:last-child { margin-bottom: 0; }
        .cred-label { font-weight: 700; color: #475569; width: 140px; display: inline-block; }
        .cred-value { font-family: 'Courier New', Courier, monospace; font-weight: 700; color: #0f172a; font-size: 15px; background: #e2e8f0; padding: 2px 8px; border-radius: 4px; }
        .notice { background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 20px; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 20px; text-align: center; }
        .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🥩 Slaughterhouse MIS</h1>
          <p>Account Credentials & Access Notification</p>
        </div>
        <div class="content">
          <p>Hello <strong>${fullName}</strong>,</p>
          <p>${actionText}</p>
          
          <div class="cred-box">
            <div class="cred-item">
              <span class="cred-label">Username:</span>
              <span class="cred-value">${username}</span>
            </div>
            <div class="cred-item">
              <span class="cred-label">Email Address:</span>
              <span>${email}</span>
            </div>
            <div class="cred-item">
              <span class="cred-label">Temporary Password:</span>
              <span class="cred-value">${tempPassword}</span>
            </div>
          </div>

          <div class="notice">
            🔒 <strong>Security Reminder:</strong> This password is temporary. For security reasons, you will be required to change your password immediately upon your first login.
          </div>

          <div style="text-align: center;">
            <a href="${loginUrl}" class="btn">Log In to Your Account</a>
          </div>
        </div>
        <div class="footer">
          Slaughterhouse Meat Inventory and Sales Management System<br>
          This is an automated system notification. Please do not reply to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${fullName},

${actionText}

Here are your account credentials:
Username: ${username}
Email Address: ${email}
Temporary Password: ${tempPassword}

Security Reminder: This password is temporary. For security reasons, you will be required to change your password immediately upon your first login.

Log in here: ${loginUrl}

Slaughterhouse Meat Inventory and Sales Management System
  `.trim();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"SMIS Admin System" <no-reply@smis.local>',
    to: email,
    subject: subject,
    text: textContent,
    html: htmlContent
  };

  const transporter = createTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ Email sent successfully to ${email} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`⚠️ Email sending failed via SMTP (${err.message}). Logging credentials to console fallback:`);
      logEmailFallback(mailOptions, username, tempPassword);
      return { success: false, error: err.message, fallback: true };
    }
  } else {
    console.log(`ℹ️ SMTP not configured in .env. Logging email notification credentials to console fallback:`);
    logEmailFallback(mailOptions, username, tempPassword);
    return { success: true, fallback: true };
  }
}

function logEmailFallback(mailOptions, username, tempPassword) {
  console.log('====================================================');
  console.log(`📧 [EMAIL FALLBACK] Subject: ${mailOptions.subject}`);
  console.log(`📧 To: ${mailOptions.to}`);
  console.log(`📧 Username: ${username}`);
  console.log(`📧 Temporary Password: ${tempPassword}`);
  console.log('====================================================');
}

module.exports = {
  sendAccountCredentialsEmail
};
