'use strict';

async function sendEmail({ to, subject, html, text, apiKey }) {
  if (!to || !subject || (!html && !text)) {
    throw new Error('to, subject, and content (html or text) are required');
  }
  // TODO: implement SendGrid v3 API
  console.log(`[sendgrid-connector] Sending email to ${to}: ${subject}`);
  return { messageId: `sg_${Date.now()}`, to, subject, status: 'queued' };
}

module.exports = { sendEmail };
