'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Campaign } = require('../models/campaign');

const router = express.Router();

// In-memory store (replace with DB in production)
const campaigns = new Map();

router.get('/', (_req, res) => {
  return res.json({ campaigns: Array.from(campaigns.values()) });
});

router.post('/', (req, res) => {
  try {
    const campaign = new Campaign({ id: uuidv4(), ...req.body });
    campaign.validate();
    campaigns.set(campaign.id, campaign);
    return res.status(201).json(campaign);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const campaign = campaigns.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'campaign not found' });
  return res.json(campaign);
});

router.patch('/:id', (req, res) => {
  const campaign = campaigns.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'campaign not found' });
  // Whitelist patchable fields to prevent mutating immutable properties like id
  const PATCHABLE = ['name', 'status', 'platforms', 'budget', 'targeting'];
  PATCHABLE.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      campaign[field] = req.body[field];
    }
  });
  try {
    campaign.validate();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  campaigns.set(campaign.id, campaign);
  return res.json(campaign);
});

router.delete('/:id', (req, res) => {
  if (!campaigns.has(req.params.id)) return res.status(404).json({ error: 'campaign not found' });
  campaigns.delete(req.params.id);
  return res.status(204).send();
});

module.exports = router;
