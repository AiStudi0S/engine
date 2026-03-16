'use strict';

const CAMPAIGN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

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
    if (!Object.values(CAMPAIGN_STATUSES).includes(this.status)) {
      throw new Error(`invalid status: ${this.status}`);
    }
    if (this.budget < 0) throw new Error('budget cannot be negative');
    return true;
  }
}

module.exports = { Campaign, CAMPAIGN_STATUSES };
