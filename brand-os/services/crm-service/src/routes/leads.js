'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Lead, LEAD_STATUSES } = require('../models/lead');

const router = express.Router();

// In-memory store (replace with PostgreSQL in production)
const leads = new Map();

router.get('/', (req, res) => {
  const { campaignId, status } = req.query;
  if (status && !Object.values(LEAD_STATUSES).includes(status)) {
    return res.status(400).json({ error: `invalid status: '${status}'. Must be one of: ${Object.values(LEAD_STATUSES).join(', ')}` });
  }
  let result = Array.from(leads.values());
  if (campaignId) result = result.filter((l) => l.campaignId === campaignId);
  if (status) result = result.filter((l) => l.status === status);
  return res.json({ leads: result, total: result.length });
});

router.post('/', (req, res) => {
  try {
    const lead = new Lead({ id: uuidv4(), ...req.body });
    lead.validate();
    leads.set(lead.id, lead);
    return res.status(201).json(lead);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'lead not found' });
  return res.json(lead);
});

router.patch('/:id', (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'lead not found' });
  // Whitelist patchable fields to prevent mutating immutable properties like id/createdAt
  const PATCHABLE = ['status', 'score', 'tags', 'metadata', 'phone'];
  PATCHABLE.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      lead[field] = req.body[field];
    }
  });
  try {
    lead.validate();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  leads.set(lead.id, lead);
  return res.json(lead);
});

module.exports = router;
