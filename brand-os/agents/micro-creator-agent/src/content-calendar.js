'use strict';

const CONTENT_TYPES = Object.freeze(['short-video', 'image-post', 'story', 'reel', 'article', 'thread']);

function generateCalendar({ persona, startDate = new Date(), weeks = 4 } = {}) {
  const calendar = [];
  const msPerDay = 86400000;

  for (let week = 0; week < weeks; week++) {
    const postsPerWeek = persona.postingFrequency === 'daily' ? 7 : persona.postingFrequency === '3x/week' ? 3 : 1;
    for (let post = 0; post < postsPerWeek; post++) {
      const dayOffset = week * 7 + Math.floor((post / postsPerWeek) * 7);
      const scheduledAt = new Date(startDate.getTime() + dayOffset * msPerDay);
      calendar.push({
        id: `post_${week}_${post}`,
        persona: persona.name,
        platform: persona.platforms[post % persona.platforms.length],
        contentType: CONTENT_TYPES[post % CONTENT_TYPES.length],
        scheduledAt: scheduledAt.toISOString(),
        status: 'pending',
      });
    }
  }
  return calendar;
}

module.exports = { generateCalendar, CONTENT_TYPES };
