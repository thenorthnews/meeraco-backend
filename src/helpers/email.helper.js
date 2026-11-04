import nodemailer from 'nodemailer';
import logger from './logger.js';

const cleanPass = process.env.EMAIL_PASS ? String(process.env.EMAIL_PASS).replace(/\s+/g, '') : '';

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : '',
      pass: cleanPass,
    },
  });
};

const transporter = createTransporter();

const senderEmail = process.env.EMAIL_USER || 'no-reply@meeraco.com';
const appName = process.env.APP_NAME || 'MEERACO CRM';

/**
 * 1. Send OTP Email
 */
export const sendOTPEmail = async (toEmail, name, otpCode) => {
  const mailOptions = {
    from: `"${appName} Security" <${senderEmail}>`,
    to: toEmail,
    subject: `${appName} - Your Verification Code is ${otpCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0b2545; margin-bottom: 8px;">Hello ${name || 'User'},</h2>
        <p style="color: #64748b; font-size: 15px;">Your requested one-time verification code for <strong>${appName}</strong> is:</p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0284c7; background: #f0f9ff; padding: 14px 28px; border-radius: 8px; border: 1px dashed #0284c7; display: inline-block;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">${appName} • Genset Sales & Operations Platform</p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER) {
      logger.info(`[EMAIL SIMULATED - NO SMTP ENV] To: ${toEmail} | OTP: ${otpCode}`);
      return { simulated: true, otpCode };
    }
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EMAIL SENT] To: ${toEmail} | OTP sent | MsgId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`[EMAIL FAILED] To: ${toEmail} | Error: ${err.message}`);
    throw err;
  }
};

/**
 * 2. Send Welcome Email
 */
export const sendWelcomeEmail = async (toEmail, name, tempPassword = null) => {
  const mailOptions = {
    from: `"${appName} Team" <${senderEmail}>`,
    to: toEmail,
    subject: `Welcome to ${appName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0b2545;">Welcome aboard, ${name}!</h2>
        <p style="color: #475569; font-size: 15px;">Your account has been successfully created in <strong>${appName}</strong>.</p>
        ${
          tempPassword
            ? `<div style="background: #f8fafc; padding: 12px 18px; border-radius: 8px; border-left: 4px solid #0284c7; margin: 15px 0;">
                <p style="margin: 0; font-size: 14px; color: #334155;">Temporary Password: <strong>${tempPassword}</strong></p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Please login and change your password immediately.</p>
               </div>`
            : ''
        }
        <div style="margin: 25px 0;">
          <a
            href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login"
            style="display: inline-block; padding: 12px 24px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;"
          >
            Login to Dashboard
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">${appName} • Genset Sales & Operations</p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER) {
      logger.info(`[EMAIL SIMULATED - NO SMTP ENV] Welcome email to: ${toEmail}`);
      return { simulated: true };
    }
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[WELCOME EMAIL SENT] To: ${toEmail} | MsgId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`[WELCOME EMAIL FAILED] To: ${toEmail} | Error: ${err.message}`);
    throw err;
  }
};

/**
 * 3. Send Forgot Password Email (Reset Link)
 */
export const sendForgotPasswordEmail = async (toEmail, name, resetUrl) => {
  const mailOptions = {
    from: `"${appName} Security" <${senderEmail}>`,
    to: toEmail,
    subject: `Reset Your ${appName} Password`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0b2545; margin-bottom: 8px;">Hello ${name || 'User'},</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">
          We received a request to reset your password for your <strong>${appName}</strong> account.
        </p>
        <p style="color: #475569; font-size: 14px;">
          Click the secure button below to set a new password:
        </p>
        <div style="text-align: center; margin: 25px 0;">
          <a
            href="${resetUrl}"
            target="_blank"
            style="
              display: inline-block;
              padding: 13px 28px;
              background-color: #0284c7;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              font-size: 15px;
              box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
            "
          >
            Reset My Password
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">
          This link will expire in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
        </p>
        <p style="color: #94a3b8; font-size: 12px; word-break: break-all; margin-top: 20px;">
          Or copy link into browser: ${resetUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">${appName} • Genset Sales & Operations</p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER) {
      logger.info(`[EMAIL SIMULATED - NO SMTP ENV] Password reset link for ${toEmail}: ${resetUrl}`);
      return { simulated: true, resetUrl };
    }
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[PASSWORD RESET EMAIL SENT] To: ${toEmail} | MsgId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`[PASSWORD RESET EMAIL FAILED] To: ${toEmail} | Error: ${err.message}`);
    throw err;
  }
};

/**
 * 4. Send Password Reset Success Email
 */
export const sendPasswordResetSuccessEmail = async (toEmail, name) => {
  const mailOptions = {
    from: `"${appName} Security" <${senderEmail}>`,
    to: toEmail,
    subject: `Your ${appName} Password Has Been Reset`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0b2545;">Hello ${name || 'User'},</h2>
        <p style="color: #475569; font-size: 15px;">
          Your <strong>${appName}</strong> account password has been successfully reset.
        </p>
        <p style="color: #475569; font-size: 14px;">
          You can now login with your new password.
        </p>
        <div style="margin: 25px 0;">
          <a
            href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login"
            style="display: inline-block; padding: 12px 24px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;"
          >
            Login Now
          </a>
        </div>
        <p style="color: #ef4444; font-size: 13px;">
          If you did not perform this action, please contact your administrator immediately.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">${appName} Security Team</p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER) {
      logger.info(`[EMAIL SIMULATED - NO SMTP ENV] Password reset success email for ${toEmail}`);
      return { simulated: true };
    }
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[PASSWORD RESET SUCCESS EMAIL SENT] To: ${toEmail} | MsgId: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`[PASSWORD RESET SUCCESS EMAIL FAILED] To: ${toEmail} | Error: ${err.message}`);
    throw err;
  }
};

/**
 * 5. Send Lead Notification Email (Worker / Notification service)
 */
export const sendLeadNotificationEmail = async (toEmail, executiveName, lead) => {
  const mailOptions = {
    from: `"${appName} Leads" <${senderEmail}>`,
    to: toEmail,
    subject: `New Lead Assigned: ${lead.leadNumber} - ${lead.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h3 style="color: #0284c7; margin-top: 0;">New Lead Assignment</h3>
        <p style="color: #475569;">Hello <strong>${executiveName}</strong>, a new lead has been assigned to you:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Lead Number:</td><td style="font-weight: bold;">${lead.leadNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Company:</td><td style="font-weight: bold;">${lead.companyName}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Contact Person:</td><td>${lead.contactPerson}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Phone:</td><td>${lead.phone}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">City / State:</td><td>${lead.city || 'N/A'}, ${lead.state || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Genset Req:</td><td>${lead.estimatedKva ? `${lead.estimatedKva} kVA` : 'Standard Genset'}</td></tr>
        </table>
        <div style="margin: 20px 0;">
          <a
            href="${process.env.CLIENT_URL || 'http://localhost:5173'}/leads"
            style="display: inline-block; padding: 11px 22px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;"
          >
            View Lead in CRM
          </a>
        </div>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER) {
      logger.info(`[EMAIL SIMULATED - NO SMTP ENV] Lead notification to ${toEmail} for lead ${lead.leadNumber}`);
      return { simulated: true };
    }
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    logger.error(`[LEAD EMAIL FAILED] To: ${toEmail} | Error: ${err.message}`);
    return null;
  }
};

export default {
  sendOTPEmail,
  sendWelcomeEmail,
  sendForgotPasswordEmail,
  sendPasswordResetSuccessEmail,
  sendLeadNotificationEmail,
};

