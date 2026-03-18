'use strict';

const axios = require('axios');

class SendGridConnector {
  constructor(config = {}) {
    this.name = 'email';
    this.apiKey = config.apiKey || process.env.SENDGRID_API_KEY;
    this.fromEmail = config.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@brandos.ai';
    this.fromName = config.fromName || process.env.SENDGRID_FROM_NAME || 'Brand OS';
    this.baseUrl = 'https://api.sendgrid.com/v3';
  }

  async sendEmail({ to, subject, html, text, templateId, templateData = {} }) {
    if (!to || !subject) throw new Error('to and subject are required');
    if (!html && !text && !templateId) throw new Error('html, text, or templateId is required');
    if (!this.apiKey) throw new Error('SendGrid API key not configured');

    const toList = Array.isArray(to) ? to : [to];
    const personalizations = toList.map((email) => ({
      to: [{ email: typeof email === 'string' ? email : email.email }],
      dynamic_template_data: templateData,
    }));

    const body = {
      personalizations,
      from: { email: this.fromEmail, name: this.fromName },
      subject,
    };

    if (templateId) {
      body.template_id = templateId;
    } else {
      body.content = [];
      if (text) body.content.push({ type: 'text/plain', value: text });
      if (html) body.content.push({ type: 'text/html', value: html });
    }

    try {
      const response = await axios.post(`${this.baseUrl}/mail/send`, body, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const messageId = response.headers['x-message-id'] || `sg_${Date.now()}`;
      return { messageId, to: toList, subject, status: 'sent' };
    } catch (err) {
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message;
      throw new Error(`SendGrid error: ${errorMsg}`);
    }
  }

  async publish(post) {
    return this.sendEmail(post);
  }
}

module.exports = SendGridConnector;
