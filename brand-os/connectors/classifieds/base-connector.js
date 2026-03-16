'use strict';

class BaseClassifiedsConnector {
  constructor({ name, apiKey }) {
    if (!name) throw new Error('connector name is required');
    this.name = name;
    this.apiKey = apiKey;
  }

  async postAd(_ad) {
    throw new Error(`${this.name}.postAd() not implemented`);
  }

  async getAdStatus(_adId) {
    throw new Error(`${this.name}.getAdStatus() not implemented`);
  }
}

module.exports = BaseClassifiedsConnector;
