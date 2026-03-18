'use strict';

const BaseEmailConnector = require('./base-connector');

class SendGridConnector extends BaseEmailConnector {
  constructor({ apiKey }) {
    super({ name: 'sendgrid', apiKey });
    this.baseUrl = 'https://api.sendgrid.com/v3';
  }

  async sendEmail({ to, from, subject, html, text }) {
    if (!to || !from || !subject || (!html && !text)) {
      throw new Error('to, from, subject, and content (html or text) are required');
    }
    // TODO: POST /mail/send via SendGrid API
    console.log(`[sendgrid] Sending email to ${to}: ${subject}`);
    return { messageId: `sg_${Date.now()}`, to, subject, status: 'queued' };
  }

  async createCampaign({ title, subject, listId, htmlContent }) {
    // TODO: POST /campaigns
    return { campaignId: `sgcampaign_${Date.now()}`, title, status: 'draft' };
  }

  async getStats(campaignId) {
    // TODO: GET /campaigns/:id/stats
    return { campaignId, opens: 0, clicks: 0, unsubscribes: 0, delivered: 0 };
  }
}

module.exports = SendGridConnector;
