'use strict';

class BaseEmailConnector {
  constructor({ name, apiKey }) {
    if (!name) throw new Error('connector name is required');
    this.name = name;
    this.apiKey = apiKey;
  }

  async sendEmail(_email) {
    throw new Error(`${this.name}.sendEmail() not implemented`);
  }

  async createCampaign(_campaign) {
    throw new Error(`${this.name}.createCampaign() not implemented`);
  }

  async getStats(_campaignId) {
    throw new Error(`${this.name}.getStats() not implemented`);
  }
}

module.exports = BaseEmailConnector;
