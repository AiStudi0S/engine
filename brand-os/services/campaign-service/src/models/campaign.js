'use strict';

const CAMPAIGN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

const ALLOWED_PLATFORMS = Object.freeze([
  'tiktok', 'instagram', 'youtube', 'x', 'reddit', 'facebook', 'linkedin', 'email',
]);

class Campaign {
  constructor({ id, name, status = CAMPAIGN_STATUSES.DRAFT, platforms = [], budget = 0, targeting = {}, createdAt = new Date() }) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.platforms = platforms;
    this.budget = budget;
    this.targeting = targeting;
    this.createdAt = createdAt;
  }

  validate() {
    if (!this.name) throw new Error('campaign name is required');
    if (this.name.length > 200) throw new Error('campaign name must be 200 characters or fewer');
    if (!Object.values(CAMPAIGN_STATUSES).includes(this.status)) {
      throw new Error(`invalid status: ${this.status}`);
    }
    if (!Array.isArray(this.platforms) || this.platforms.length === 0) {
      throw new Error('platforms must be a non-empty array');
    }
    const invalid = this.platforms.filter((p) => !ALLOWED_PLATFORMS.includes(p));
    if (invalid.length > 0) {
      throw new Error(`invalid platform(s): ${invalid.join(', ')}. Allowed: ${ALLOWED_PLATFORMS.join(', ')}`);
    }
    if (this.budget < 0) throw new Error('budget cannot be negative');
    return true;
  }
}

module.exports = { Campaign, CAMPAIGN_STATUSES, ALLOWED_PLATFORMS };
