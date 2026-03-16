'use strict';

const MAX_PLATFORM_FRACTION = 0.6;

function optimizeBudget({ totalBudget, platforms, performanceHistory = {} }) {
  if (!platforms || platforms.length === 0) return {};

  const defaultWeight = 1 / platforms.length;
  const weights = {};

  platforms.forEach((platform) => {
    const history = performanceHistory[platform];
    weights[platform] = history ? (history.roi || defaultWeight) : defaultWeight;
  });

  // Iterative capping: cap platforms at MAX_PLATFORM_FRACTION and
  // redistribute the excess proportionally to uncapped platforms until
  // the full budget is assigned.
  let fractions = {};
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  platforms.forEach((p) => { fractions[p] = weights[p] / totalWeight; });

  let changed = true;
  while (changed) {
    changed = false;
    const capped = platforms.filter((p) => fractions[p] >= MAX_PLATFORM_FRACTION);
    const uncapped = platforms.filter((p) => fractions[p] < MAX_PLATFORM_FRACTION);

    // If all platforms are at/above cap there is nowhere to redistribute:
    // the ceiling cannot be satisfied with the given platform mix, so skip.
    if (uncapped.length === 0) break;

    let excess = 0;
    capped.forEach((p) => {
      excess += fractions[p] - MAX_PLATFORM_FRACTION;
      fractions[p] = MAX_PLATFORM_FRACTION;
    });

    if (excess > 1e-9) {
      const uncappedSum = uncapped.reduce((s, p) => s + fractions[p], 0);
      uncapped.forEach((p) => {
        fractions[p] += excess * (fractions[p] / uncappedSum);
      });
      changed = true;
    }
  }

  const allocation = {};
  platforms.forEach((platform) => {
    allocation[platform] = Math.round(fractions[platform] * totalBudget * 100) / 100;
  });

  return allocation;
}

module.exports = { optimizeBudget };
