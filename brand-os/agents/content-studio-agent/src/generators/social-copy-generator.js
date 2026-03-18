'use strict';

async function generate({ topic, platforms = ['x', 'instagram'], tone = 'engaging' } = {}) {
  return platforms.reduce((acc, platform) => {
    acc[platform] = `[${platform.toUpperCase()}] ${topic} — ${tone} copy placeholder`;
    return acc;
  }, {});
}

module.exports = { generate };
