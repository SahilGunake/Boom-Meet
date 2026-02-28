const nodemailer = require('nodemailer');

/**
 * Send an email using the configured SMTP transport.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in your .env file.
 */
async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Boom Meet" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = sendEmail;
