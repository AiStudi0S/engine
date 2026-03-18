'use strict';

class BaseCreatorPlatformConnector {
  constructor({ name, apiKey }) {
    if (!name) throw new Error('connector name is required');
    this.name = name;
    this.apiKey = apiKey;
  }

  async uploadContent(_content) {
    throw new Error(`${this.name}.uploadContent() not implemented`);
  }

  async getChannelStats(_channelId) {
    throw new Error(`${this.name}.getChannelStats() not implemented`);
  }
}

module.exports = BaseCreatorPlatformConnector;
