'use strict';

class BaseSocialConnector {
  constructor({ name, apiKey, apiSecret }) {
    if (!name) throw new Error('connector name is required');
    this.name = name;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async publish(_post) {
    throw new Error(`${this.name}.publish() not implemented`);
  }

  async getAnalytics(_postId) {
    throw new Error(`${this.name}.getAnalytics() not implemented`);
  }

  async getMessages(_options) {
    throw new Error(`${this.name}.getMessages() not implemented`);
  }
}

module.exports = BaseSocialConnector;
