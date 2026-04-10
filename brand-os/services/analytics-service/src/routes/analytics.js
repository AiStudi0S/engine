'use strict';

const express = require('express');
const logger = require('../logger');

module.exports = function createAnalyticsRouter(pool) {
  const router = express.Router();

  // POST /api/analytics/events - ingest event directly
  router.post('/events', async (req, res) => {
    try {
      const { campaignId, eventType, platform = 'unknown', metric, value = 0, metadata = {} } = req.body;
      if (!campaignId || !eventType) {
        return res.status(400).json({ error: 'campaignId and eventType are required' });
      }
      await pool.query(
        'INSERT INTO analytics_events (campaign_id, platform, event_type, metric, value, metadata) VALUES ($1,$2,$3,$4,$5,$6)',
        [campaignId, platform, eventType, metric || eventType, value, JSON.stringify(metadata)]
      );
      return res.status(202).json({ accepted: true, campaignId, eventType });
    } catch (err) {
      logger.error('ingest event error', { error: err.message });
      return res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/analytics/campaigns/:id/metrics
  router.get('/campaigns/:id/metrics', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT
          event_type,
          SUM(value) as total_value,
          COUNT(*) as event_count,
          AVG(value) as avg_value
         FROM analytics_events
         WHERE campaign_id = $1
         GROUP BY event_type`,
        [id]
      );
      const metrics = { campaignId: id, impressions: 0, clicks: 0, conversions: 0, revenue: 0, spend: 0, events: {} };
      result.rows.forEach((row) => {
        metrics.events[row.event_type] = { total: parseFloat(row.total_value), count: parseInt(row.event_count, 10), avg: parseFloat(row.avg_value) };
        if (row.event_type === 'impression') metrics.impressions = parseFloat(row.total_value);
        else if (row.event_type === 'click') metrics.clicks = parseFloat(row.total_value);
        else if (row.event_type === 'conversion') metrics.conversions = parseFloat(row.total_value);
        else if (row.event_type === 'revenue') metrics.revenue = parseFloat(row.total_value);
        else if (row.event_type === 'spend') metrics.spend = parseFloat(row.total_value);
      });
      metrics.ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
      metrics.roi = metrics.spend > 0 ? (metrics.revenue - metrics.spend) / metrics.spend : 0;
      return res.json(metrics);
    } catch (err) {
      logger.error('get campaign metrics error', { error: err.message });
      return res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/analytics/campaigns/:id/performance - time-series
  router.get('/campaigns/:id/performance', async (req, res) => {
    try {
      const { id } = req.params;
      const days = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10) || 30));
      const result = await pool.query(
        `SELECT
          date_trunc('day', recorded_at) as date,
          event_type,
          SUM(value) as total_value,
          COUNT(*) as event_count
         FROM analytics_events
         WHERE campaign_id = $1 AND recorded_at >= NOW() - make_interval(days => $2)
         GROUP BY date_trunc('day', recorded_at), event_type
         ORDER BY date ASC`,
        [id, days]
      );
      return res.json({ campaignId: id, timeSeries: result.rows });
    } catch (err) {
      logger.error('get campaign performance error', { error: err.message });
      return res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/analytics/overview
  router.get('/overview', async (req, res) => {
    try {
      const eventsResult = await pool.query(
        `SELECT event_type, COUNT(*) as count, SUM(value) as total FROM analytics_events GROUP BY event_type`
      );
      const campaignCountResult = await pool.query(
        `SELECT COUNT(DISTINCT campaign_id) as active_campaigns FROM analytics_events WHERE recorded_at > NOW() - INTERVAL '30 days'`
      );
      const stats = { totalEvents: 0, activeCampaigns: parseInt(campaignCountResult.rows[0].active_campaigns, 10), byEventType: {} };
      eventsResult.rows.forEach((row) => {
        stats.byEventType[row.event_type] = { count: parseInt(row.count), total: parseFloat(row.total) };
        stats.totalEvents += parseInt(row.count);
      });
      return res.json(stats);
    } catch (err) {
      logger.error('get overview error', { error: err.message });
      return res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
};
