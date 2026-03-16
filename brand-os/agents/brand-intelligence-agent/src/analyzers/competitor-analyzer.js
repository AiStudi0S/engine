'use strict';

async function scan({ competitors = [], platforms = [] } = {}) {
  return competitors.map((competitor) => ({
    competitor,
    adActivity: 'moderate',
    estimatedBudget: '$5k-$15k/mo',
    topPlatforms: platforms.slice(0, 2),
    signals: ['increased_spend', 'new_creative_format'],
  }));
}

module.exports = { scan };
