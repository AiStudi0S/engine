'use strict';

const BaseSocialConnector = require('./base-connector');

class InstagramConnector extends BaseSocialConnector {
  constructor(config) {
    super({ name: 'instagram', ...config });
    this.baseUrl = 'https://graph.instagram.com';
  }

  async publish(post) {
    const { caption, imageUrl, videoUrl } = post;
    if (!caption) throw new Error('caption is required');
    // TODO: use Instagram Graph API (media container + publish)
    console.log(`[instagram] Publishing: ${caption.slice(0, 50)}...`);
    return { id: `ig_${Date.now()}`, caption, platform: 'instagram' };
  }

  async getAnalytics(postId) {
    return { postId, impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0 };
  }

  async getMessages(options = {}) {
    return { messages: [] };
  }
}

module.exports = InstagramConnector;
