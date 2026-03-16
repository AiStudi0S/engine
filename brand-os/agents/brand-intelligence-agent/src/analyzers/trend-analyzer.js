'use strict';

/**
 * Simple deterministic hash of a string → float in [0, 1].
 * Uses a djb2-style hash for consistency across runs.
 */
function deterministicScore(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // keep as 32-bit int
  }
  // Map to [0, 1]
  return (Math.abs(hash) % 10000) / 10000;
}

async function analyze({ keywords = [], platforms = ['google', 'reddit', 'tiktok'] } = {}) {
  // TODO: integrate Google Trends API, Reddit API, TikTok Research API
  return keywords.map((keyword, i) => {
    const score = 0.5 + deterministicScore(keyword) * 0.5;
    // Select platforms deterministically based on keyword + platform name hash
    const activePlatforms = platforms.filter((p) => deterministicScore(`${keyword}:${p}`) > 0.3);
    return {
      keyword,
      opportunityScore: Math.round(score * 100) / 100,
      trendDirection: ['rising', 'stable', 'declining'][i % 3],
      platforms: activePlatforms.length > 0 ? activePlatforms : [platforms[0]],
      relatedTopics: [],
    };
  });
}

module.exports = { analyze };
