'use strict';

const { v4: uuidv4 } = require('uuid');
const BaseSocialConnector = require('../social/base-connector');

class XConnector extends BaseSocialConnector {
  constructor(config) {
    super({ name: 'x', ...config });
    this.baseUrl = 'https://api.twitter.com/2';
  }

  async publish(post) {
    const { text, mediaIds = [], replyToId } = post;
    if (!text) throw new Error('tweet text is required');
    if (text.length > 280) throw new Error('tweet exceeds 280 character limit');
    // TODO: POST /tweets via X API v2 with OAuth 2.0 PKCE
    const body = { text };
    if (mediaIds.length > 0) body.media = { media_ids: mediaIds };
    if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
    console.log(`[x] Posting: ${text.slice(0, 50)}...`);
    return { id: uuidv4(), text, platform: 'x' };
  }

  async publishThread(tweets) {
    if (!Array.isArray(tweets) || tweets.length === 0) throw new Error('tweets array is required');
    const results = [];
    let replyToId;
    for (const tweet of tweets) {
      const result = await this.publish({ ...tweet, replyToId });
      results.push(result);
      replyToId = result.id;
    }
    return results;
  }

  async getAnalytics(postId) {
    // TODO: GET /tweets/:id?tweet.fields=public_metrics
    return { postId, impressions: 0, likes: 0, retweets: 0, replies: 0, clicks: 0 };
  }

  async getMessages(_options = {}) {
    // TODO: GET /dm_events
    return { messages: [] };
  }
}

module.exports = XConnector;
