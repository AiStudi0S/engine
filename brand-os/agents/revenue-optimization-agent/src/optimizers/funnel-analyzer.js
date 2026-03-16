'use strict';

function analyzeFunnel({ stages = [] }) {
  if (!stages.length) return { conversionRate: 0, dropOffPoints: [], recommendations: [] };

  const dropOffPoints = [];
  let overallConversion = 1;

  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const curr = stages[i];
    const rate = prev.count > 0 ? curr.count / prev.count : 0;
    overallConversion *= rate;

    if (rate < 0.5) {
      dropOffPoints.push({
        from: prev.name,
        to: curr.name,
        dropOffRate: Math.round((1 - rate) * 100),
        recommendation: `Improve conversion from ${prev.name} to ${curr.name} — ${Math.round((1 - rate) * 100)}% drop-off detected.`,
      });
    }
  }

  return {
    conversionRate: Math.round(overallConversion * 10000) / 100,
    dropOffPoints,
    recommendations: dropOffPoints.map((d) => d.recommendation),
  };
}

module.exports = { analyzeFunnel };
