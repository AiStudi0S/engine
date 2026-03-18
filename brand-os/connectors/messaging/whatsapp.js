'use strict';

class WhatsAppConnector {
  constructor({ phoneNumberId, accessToken }) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  async sendMessage({ to, text }) {
    if (!to || !text) throw new Error('to and text are required');
    // TODO: POST /messages via WhatsApp Business API
    console.log(`[whatsapp] Sending to ${to}: ${text.slice(0, 50)}...`);
    return { messageId: `wa_${Date.now()}`, to, status: 'sent' };
  }

  async sendTemplate({ to, templateName, language = 'en_US', components = [] }) {
    if (!to || !templateName) throw new Error('to and templateName are required');
    // TODO: POST /messages with template type
    return { messageId: `wa_tmpl_${Date.now()}`, to, templateName, status: 'sent' };
  }
}

module.exports = WhatsAppConnector;
