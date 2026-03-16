'use strict';

const { v4: uuidv4 } = require('uuid');
const BaseSocialConnector = require('../social/base-connector');

class YouTubeConnector extends BaseSocialConnector {
  constructor(config) {
    super({ name: 'youtube', ...config });
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  async publish(post) {
    const { videoPath, title, description, tags = [], categoryId = '22' } = post;
    if (!videoPath) throw new Error('videoPath is required for YouTube');
    if (!title) throw new Error('title is required for YouTube');
    // TODO: use YouTube Data API v3 — videos.insert with resumable upload
    console.log(`[youtube] Uploading: ${title}`);
    return { id: uuidv4(), title, platform: 'youtube' };
  }

  async getAnalytics(postId) {
    // TODO: YouTube Analytics API — reports.query
    return { postId, views: 0, likes: 0, comments: 0, averageViewDuration: 0 };
  }

  async getMessages(_options = {}) {
    // YouTube does not have a DM API; return empty
    return { messages: [] };
  }
}

module.exports = YouTubeConnector;
