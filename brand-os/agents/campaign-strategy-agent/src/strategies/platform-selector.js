'use strict';

const PLATFORM_SCORES = {
  tiktok: { reach: 0.9, engagement: 0.85, costEfficiency: 0.8 },
  instagram: { reach: 0.85, engagement: 0.8, costEfficiency: 0.75 },
  youtube: { reach: 0.8, engagement: 0.7, costEfficiency: 0.7 },
  facebook: { reach: 0.75, engagement: 0.6, costEfficiency: 0.65 },
  x: { reach: 0.65, engagement: 0.55, costEfficiency: 0.6 },
  linkedin: { reach: 0.5, engagement: 0.6, costEfficiency: 0.5 },
};

function selectPlatforms({ targetAudience, budget, objectives = [] }) {
  const platforms = Object.entries(PLATFORM_SCORES)
    .map(([name, scores]) => ({
      name,
      score: (scores.reach + scores.engagement + scores.costEfficiency) / 3,
      ...scores,
    }))
    .sort((a, b) => b.score - a.score);

  const maxPlatforms = budget >= 5000 ? 4 : budget >= 1000 ? 3 : 2;
  return platforms.slice(0, maxPlatforms).map((p) => p.name);
}

module.exports = { selectPlatforms, PLATFORM_SCORES };
