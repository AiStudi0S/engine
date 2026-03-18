'use strict';

const BaseSocialConnector = require('./base-connector');

class TwitterConnector extends BaseSocialConnector {
  constructor(config) {
    // Canonical platform identifier is 'x'; 'twitter' is kept as an alias for
    // backward-compatibility with external API references (Twitter API v2 URLs).
    super({ name: 'x', ...config });
    this.baseUrl = 'https://api.twitter.com/2';
  }

  async publish(post) {
    const { text, mediaIds = [] } = post;
    if (!text) throw new Error('tweet text is required');
    if (text.length > 280) throw new Error('tweet exceeds 280 character limit');
    // TODO: implement using Twitter API v2 with OAuth 2.0
    console.log(`[x] Publishing: ${text.slice(0, 50)}...`);
    return { id: `tweet_${Date.now()}`, text, platform: 'x' };
  }

  async getAnalytics(postId) {
    // TODO: GET /tweets/:id with engagement fields
    return { postId, impressions: 0, likes: 0, retweets: 0, clicks: 0 };
  }

  async getMessages(options = {}) {
    // TODO: GET /dm_events
    return { messages: [] };
  }
}

module.exports = TwitterConnector;
