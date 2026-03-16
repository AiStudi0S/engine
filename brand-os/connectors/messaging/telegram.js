'use strict';

class TelegramConnector {
  constructor({ botToken }) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage({ chatId, text, parseMode = 'HTML' }) {
    if (!chatId || !text) throw new Error('chatId and text are required');
    // TODO: POST /sendMessage via Telegram Bot API
    console.log(`[telegram] Sending to ${chatId}: ${text.slice(0, 50)}...`);
    return { messageId: `tg_${Date.now()}`, chatId, status: 'sent' };
  }

  async broadcastMessage({ channelId, text }) {
    return this.sendMessage({ chatId: channelId, text });
  }
}

module.exports = TelegramConnector;
