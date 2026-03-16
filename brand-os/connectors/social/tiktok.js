'use strict';

const BaseSocialConnector = require('./base-connector');

class TikTokConnector extends BaseSocialConnector {
  constructor(config) {
    super({ name: 'tiktok', ...config });
    this.baseUrl = 'https://open.tiktokapis.com/v2';
  }

  async publish(post) {
    const { videoUrl, caption } = post;
    if (!videoUrl) throw new Error('videoUrl is required for TikTok');
    console.log(`[tiktok] Publishing video: ${caption}`);
    return { id: `tt_${Date.now()}`, caption, platform: 'tiktok' };
  }

  async getAnalytics(postId) {
    return { postId, views: 0, likes: 0, comments: 0, shares: 0 };
  }

  async getMessages(options = {}) {
    return { messages: [] };
  }
}

module.exports = TikTokConnector;
