'use strict';

async function generate({ topic, tone = 'informative', wordCount = 800 } = {}) {
  // TODO: call AI engine /api/copy/generate
  return {
    title: `[Generated] ${topic}`,
    body: `This is a placeholder article about ${topic}. Word count target: ${wordCount}.`,
    tone,
    seoKeywords: [topic],
    readTime: Math.ceil(wordCount / 200),
  };
}

module.exports = { generate };
