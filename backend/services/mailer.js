'use strict';
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

if (config.smtp && config.smtp.host) {
  transporter = nodemailer.createTransport({
    host:   config.smtp.host,
    port:   config.smtp.port || 465,
    secure: (config.smtp.port || 465) === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
  console.log('[mailer] SMTP configured via', config.smtp.host);
} else {
  console.warn('[mailer] No SMTP configured — confirmation links will be returned in API responses');
}

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log('[mailer] No SMTP — skipping email to:', to);
    return null;
  }
  return transporter.sendMail({ from: config.smtp.from, to, subject, html });
}

async function sendConfirmationEmail(email, token) {
  const link = `${config.appUrl}/confirm.html?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Confirm your Stellar Dashboard account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#1a1a1f;color:#cdccca;padding:32px;border-radius:8px">
        <h2 style="color:#4dd9c0;margin-top:0">Stellar Dashboard</h2>
        <p>Welcome! Please confirm your email address:</p>
        <p>
          <a href="${link}"
             style="display:inline-block;background:#4dd9c0;color:#1a1a1f;padding:12px 24px;
                    border-radius:6px;text-decoration:none;font-weight:bold">
            Confirm Email
          </a>
        </p>
        <p style="color:#888;font-size:13px">Or copy this link: ${link}</p>
        <p style="color:#888;font-size:13px">This link expires in 24 hours.</p>
      </div>
    `,
  });
  return link;
}

const smtpEnabled = !!transporter;
module.exports = { sendMail, sendConfirmationEmail, smtpEnabled };
