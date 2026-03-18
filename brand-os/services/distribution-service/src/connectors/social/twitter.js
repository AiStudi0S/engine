'use strict';

const axios = require('axios');
const crypto = require('crypto');

/**
 * Build an OAuth 1.0a Authorization header for Twitter API v2.
 * Twitter tweet creation (POST /2/tweets) requires user-context auth,
 * not a bare bearer token.
 */
function buildOAuth1Header(method, url, credentials) {
  const oauthParams = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  };

  // Signature base string: sorted, percent-encoded key=value pairs
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(credentials.apiSecret)}&${encodeURIComponent(credentials.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  return (
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ')
  );
}

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

    if (!this.apiKey || !this.apiSecret || !this.accessToken || !this.accessTokenSecret) {
      throw new Error(
        'Twitter API credentials not configured — TWITTER_API_KEY, TWITTER_API_SECRET, ' +
        'TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET are all required'
      );
    }

    try {
      const url = `${this.baseUrl}/tweets`;
      const body = { text };
      if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
      }

      // POST /2/tweets requires user-context OAuth 1.0a, not app-only bearer token
      const authHeader = buildOAuth1Header('POST', url, {
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessTokenSecret: this.accessTokenSecret,
      });

      const response = await axios.post(url, body, {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

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
      // GET requests can use the app-only bearer token
      const response = await axios.get(
        `${this.baseUrl}/tweets/${postId}`,
        {
          params: { 'tweet.fields': 'public_metrics' },
          headers: { Authorization: `Bearer ${this.bearerToken}` },
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
