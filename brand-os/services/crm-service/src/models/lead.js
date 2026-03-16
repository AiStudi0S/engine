'use strict';

const LEAD_STATUSES = Object.freeze({
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  LOST: 'lost',
});

class Lead {
  constructor({ id, email, phone = '', campaignId, source, score = 0, status = LEAD_STATUSES.NEW, metadata = {}, createdAt = new Date() }) {
    this.id = id;
    this.email = email;
    this.phone = phone;
    this.campaignId = campaignId;
    this.source = source;
    this.score = score;
    this.status = status;
    this.metadata = metadata;
    this.createdAt = createdAt;
  }

  validate() {
    if (!this.email) throw new Error('lead email is required');
    if (!this.campaignId) throw new Error('campaignId is required');
    if (this.score < 0 || this.score > 100) throw new Error('score must be between 0 and 100');
    if (!Object.values(LEAD_STATUSES).includes(this.status)) {
      throw new Error(`invalid status: ${this.status}`);
    }
    return true;
  }
}

module.exports = { Lead, LEAD_STATUSES };
