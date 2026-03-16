'use strict';

async function analyze({ keywords = [], platforms = ['google', 'reddit', 'tiktok'] } = {}) {
  // TODO: integrate Google Trends API, Reddit API, TikTok Research API
  return keywords.map((keyword, i) => ({
    keyword,
    opportunityScore: Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
    trendDirection: ['rising', 'stable', 'declining'][i % 3],
    platforms: platforms.filter(() => Math.random() > 0.3),
    relatedTopics: [],
  }));
}

module.exports = { analyze };
