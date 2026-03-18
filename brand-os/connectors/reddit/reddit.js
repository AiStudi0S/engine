'use strict';

const { v4: uuidv4 } = require('uuid');

class RedditConnector {
  constructor({ clientId, clientSecret, username, password }) {
    if (!clientId || !clientSecret) throw new Error('Reddit clientId and clientSecret are required');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.username = username;
    this.password = password;
    this.baseUrl = 'https://oauth.reddit.com';
    this.accessToken = null;
  }

  async publish(post) {
    const { subreddit, title, text, url, kind = 'self' } = post;
    if (!subreddit) throw new Error('subreddit is required');
    if (!title) throw new Error('title is required');
    // TODO: POST /api/submit via Reddit OAuth2
    console.log(`[reddit] Submitting to r/${subreddit}: ${title}`);
    return { id: uuidv4(), title, subreddit, platform: 'reddit' };
  }

  async getAnalytics(postId) {
    // TODO: GET /by_id/<fullname> and parse score/comments
    return { postId, upvotes: 0, downvotes: 0, comments: 0, upvoteRatio: 0 };
  }

  async getMessages(_options = {}) {
    // TODO: GET /message/inbox
    return { messages: [] };
  }

  async comment(postId, text) {
    if (!postId) throw new Error('postId is required');
    if (!text) throw new Error('comment text is required');
    // TODO: POST /api/comment
    console.log(`[reddit] Commenting on ${postId}: ${text.slice(0, 50)}...`);
    return { id: uuidv4(), postId, platform: 'reddit' };
  }
}

module.exports = RedditConnector;
