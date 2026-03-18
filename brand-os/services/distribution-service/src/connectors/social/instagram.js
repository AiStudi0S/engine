'use strict';

const axios = require('axios');

class InstagramConnector {
  constructor(config = {}) {
    this.name = 'instagram';
    this.accessToken = config.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
    this.accountId = config.accountId || process.env.INSTAGRAM_ACCOUNT_ID;
    this.baseUrl = 'https://graph.facebook.com/v18.0';
  }

  async publish(post) {
    const { caption, imageUrl, videoUrl } = post;
    if (!caption) throw new Error('caption is required');
    if (!this.accessToken || !this.accountId) {
      throw new Error('Instagram credentials not configured');
    }

    try {
      const containerPayload = {
        caption,
        access_token: this.accessToken,
      };

      if (videoUrl) {
        containerPayload.media_type = 'REELS';
        containerPayload.video_url = videoUrl;
      } else if (imageUrl) {
        containerPayload.image_url = imageUrl;
      } else {
        throw new Error('imageUrl or videoUrl is required for Instagram posts');
      }

      const containerRes = await axios.post(
        `${this.baseUrl}/${this.accountId}/media`,
        containerPayload,
        { timeout: 15000 }
      );
      const containerId = containerRes.data.id;

      const publishRes = await axios.post(
        `${this.baseUrl}/${this.accountId}/media_publish`,
        { creation_id: containerId, access_token: this.accessToken },
        { timeout: 15000 }
      );

      const mediaId = publishRes.data.id;

      // Fetch the canonical permalink (media_id is not a shortcode)
      let permalink = null;
      try {
        const detailRes = await axios.get(`${this.baseUrl}/${mediaId}`, {
          params: { fields: 'permalink', access_token: this.accessToken },
          timeout: 10000,
        });
        permalink = detailRes.data.permalink || null;
      } catch {
        // Non-fatal: proceed without a permalink
      }

      return {
        id: mediaId,
        caption,
        platform: 'instagram',
        url: permalink,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      throw new Error(`Instagram API error: ${errorMsg}`);
    }
  }

  async getAnalytics(postId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${postId}/insights`,
        {
          params: {
            metric: 'impressions,reach,likes,comments,shares',
            access_token: this.accessToken,
          },
          timeout: 10000,
        }
      );
      const metrics = {};
      (response.data.data || []).forEach((m) => { metrics[m.name] = m.values[0]?.value || 0; });
      return { postId, ...metrics };
    } catch {
      return { postId, impressions: 0, reach: 0, likes: 0 };
    }
  }
}

module.exports = InstagramConnector;
