'use strict';

function optimizeBudget({ totalBudget, platforms, performanceHistory = {} }) {
  if (!platforms || platforms.length === 0) return {};

  const weights = {};
  const defaultWeight = 1 / platforms.length;

  platforms.forEach((platform) => {
    const history = performanceHistory[platform];
    weights[platform] = history ? history.roi || defaultWeight : defaultWeight;
  });

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const allocation = {};

  platforms.forEach((platform) => {
    const fraction = weights[platform] / totalWeight;
    // Cap any single platform at 60% of budget
    allocation[platform] = Math.round(Math.min(fraction, 0.6) * totalBudget * 100) / 100;
  });

  return allocation;
}

module.exports = { optimizeBudget };
