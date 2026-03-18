'use strict';

const axios = require('axios');

class TwitterConnector {
  constructor(config = {}) {
    this.name = 'x';
    this.bearerToken = config.bearerToken || process.env.TWITTER_BEARER_TOKEN;
    this.apiKey = config.apiKey || process.env.TWITTER_API_KEY;
    this.apiSecret = config.apiSecret || process.env.TWITTER_API_SECRET;
    this.accessToken = config.accessToken || process.env.TWITTER_ACCESS_TOKEN;
    this.accessTokenSecret = config.accessTokenSecret || process.env.TWITTER_ACCESS_TOKEN_SECRET;
    this.baseUrl = 'https://api.twitter.com/2';
  }

  async publish(post) {
    const { text, mediaIds = [] } = post;
    if (!text) throw new Error('tweet text is required');
    if (text.length > 280) throw new Error('tweet exceeds 280 character limit');

    if (!this.bearerToken && !this.accessToken) {
      throw new Error('Twitter API credentials not configured');
    }

    try {
      const body = { text };
      if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
      }

      const response = await axios.post(
        `${this.baseUrl}/tweets`,
        body,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return {
        id: response.data.data.id,
        text: response.data.data.text,
        platform: 'x',
        url: `https://twitter.com/i/web/status/${response.data.data.id}`,
      };
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.detail || err.message;
      throw new Error(`Twitter API error (${status}): ${errorMsg}`);
    }
  }

  async getAnalytics(postId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/tweets/${postId}`,
        {
          params: { 'tweet.fields': 'public_metrics' },
          headers: { 'Authorization': `Bearer ${this.bearerToken}` },
          timeout: 10000,
        }
      );
      const metrics = response.data.data.public_metrics || {};
      return {
        postId,
        impressions: metrics.impression_count || 0,
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        clicks: metrics.url_link_clicks || 0,
      };
    } catch {
      return { postId, impressions: 0, likes: 0, retweets: 0, clicks: 0 };
    }
  }
}

module.exports = TwitterConnector;
