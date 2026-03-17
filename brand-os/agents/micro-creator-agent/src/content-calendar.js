'use strict';

const CONTENT_TYPES = Object.freeze(['short-video', 'image-post', 'story', 'reel', 'article', 'thread', 'newsletter']);

function getPostsPerWeek(postingFrequency) {
  switch (postingFrequency) {
    case 'daily': return 7;
    case '3x/week': return 3;
    case 'weekly': return 1;
    case 'bi-weekly': return 0.5; // one post every two weeks
    default: return 1;
  }
}

function generateCalendar({ persona, startDate = new Date(), weeks = 4 } = {}) {
  if (!persona) throw new Error('persona is required');
  if (!Array.isArray(persona.platforms) || persona.platforms.length === 0) {
    throw new Error('persona.platforms must be a non-empty array');
  }
  if (!persona.postingFrequency) throw new Error('persona.postingFrequency is required');

  const calendar = [];
  const msPerDay = 86400000;
  const postsPerWeek = getPostsPerWeek(persona.postingFrequency);
  const contentTypes = (persona.contentTypes && persona.contentTypes.length > 0)
    ? persona.contentTypes
    : CONTENT_TYPES;

  let postIndex = 0;
  for (let week = 0; week < weeks; week++) {
    // For bi-weekly, publish on even weeks only (week 0, 2, 4…) so the
    // first post always appears at startDate regardless of week parity.
    if (postsPerWeek < 1 && week % 2 !== 0) continue;

    const postsThisWeek = postsPerWeek < 1 ? 1 : postsPerWeek;
    for (let post = 0; post < postsThisWeek; post++) {
      const dayOffset = week * 7 + Math.floor((post / postsThisWeek) * 7);
      const scheduledAt = new Date(startDate.getTime() + dayOffset * msPerDay);
      calendar.push({
        id: `post_${week}_${post}`,
        persona: persona.name,
        platform: persona.platforms[postIndex % persona.platforms.length],
        contentType: contentTypes[postIndex % contentTypes.length],
        scheduledAt: scheduledAt.toISOString(),
        status: 'pending',
      });
      postIndex++;
    }
  }
  return calendar;
}

module.exports = { generateCalendar, CONTENT_TYPES };
