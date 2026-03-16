'use strict';

async function publishPost({ caption, imageUrl, accessToken }) {
  if (!caption) throw new Error('caption is required');
  // TODO: implement Instagram Graph API (media container + publish)
  console.log(`[instagram-connector] Publishing: ${caption.slice(0, 50)}...`);
  return { id: `ig_${Date.now()}`, caption, platform: 'instagram' };
}

module.exports = { publishPost };
