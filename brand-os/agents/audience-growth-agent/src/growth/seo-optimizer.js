'use strict';

function optimizeSEO({ content, targetKeywords = [], platform = 'web' }) {
  const suggestions = [];

  if (content && content.length < 300) {
    suggestions.push({ type: 'warning', message: 'Content is below 300 words; consider expanding for better SEO.' });
  }

  targetKeywords.forEach((keyword) => {
    const count = (content || '').toLowerCase().split(keyword.toLowerCase()).length - 1;
    if (count === 0) {
      suggestions.push({ type: 'missing_keyword', keyword, message: `Keyword "${keyword}" not found in content.` });
    } else if (count > 5) {
      suggestions.push({ type: 'keyword_stuffing', keyword, message: `Keyword "${keyword}" appears ${count} times. Consider reducing.` });
    }
  });

  return {
    score: Math.max(0, 100 - suggestions.filter((s) => s.type !== 'warning').length * 10),
    suggestions,
    optimizedKeywords: targetKeywords,
  };
}

module.exports = { optimizeSEO };
