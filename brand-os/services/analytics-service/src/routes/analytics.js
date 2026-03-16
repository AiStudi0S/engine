'use strict';

const express = require('express');
const router = express.Router();

router.post('/events', (req, res) => {
  try {
    const { campaignId, eventType, platform, value = 0, metadata = {} } = req.body;
    if (!campaignId || !eventType || !platform) {
      return res.status(400).json({ error: 'campaignId, eventType, and platform are required' });
    }
    // TODO: write to ClickHouse via Kafka
    return res.status(202).json({ accepted: true, campaignId, eventType });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/campaigns/:id/metrics', (req, res) => {
  // TODO: query ClickHouse campaign_metrics_daily
  return res.json({
    campaignId: req.params.id,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    spend: 0,
    ctr: 0,
    roi: 0,
  });
});

router.get('/campaigns/:id/funnel', (req, res) => {
  // TODO: query ClickHouse funnel_analysis materialized view
  return res.json({ campaignId: req.params.id, funnel: [] });
});

module.exports = router;
