'use strict';

const express = require('express');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const { CAMPAIGN_STATUSES, ALLOWED_PLATFORMS } = require('../models/campaign');
const logger = require('../logger');

const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const kafka = new Kafka({ clientId: 'campaign-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') });
const producer = kafka.producer();
let producerReady = false;

(async () => {
  try {
    await producer.connect();
    producerReady = true;
    logger.info('Kafka producer connected');
  } catch (err) {
    logger.error('Kafka producer connection failed', { error: err.message });
  }
})();

async function publishEvent(eventType, data) {
  if (!producerReady) return;
  try {
    await producer.send({
      topic: 'campaign.events',
      messages: [{ key: data.id, value: JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() }) }],
    });
  } catch (err) {
    logger.error('Kafka publish error', { error: err.message, eventType });
  }
}

function validate(body) {
  const { name, platforms, budget } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) throw new Error('campaign name is required');
  if (name.length > 200) throw new Error('campaign name must be 200 characters or fewer');
  if (!Array.isArray(platforms) || platforms.length === 0) throw new Error('platforms must be a non-empty array');
  const invalid = platforms.filter((p) => !ALLOWED_PLATFORMS.includes(p));
  if (invalid.length > 0) throw new Error(`invalid platform(s): ${invalid.join(', ')}`);
  if (budget !== undefined && (isNaN(budget) || budget < 0)) throw new Error('budget cannot be negative');
}

// GET /api/campaigns - list with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let whereClause = '';
    const params = [];
    if (status) {
      if (!Object.values(CAMPAIGN_STATUSES).includes(status)) {
        return res.status(400).json({ error: `invalid status: ${status}` });
      }
      params.push(status);
      whereClause += `WHERE status = $${params.length}`;
    }
    params.push(limit, offset);
    const countResult = await pool.query(`SELECT COUNT(*) FROM campaigns ${whereClause}`, params.slice(0, params.length - 2));
    const dataResult = await pool.query(
      `SELECT * FROM campaigns ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({ campaigns: dataResult.rows, total: parseInt(countResult.rows[0].count, 10), page, limit });
  } catch (err) {
    logger.error('list campaigns error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/campaigns
router.post('/', async (req, res) => {
  try {
    validate(req.body);
    const { name, platforms, budget = 0, start_date, end_date, brand_id } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO campaigns (id, name, status, platforms, budget, start_date, end_date, brand_id)
       VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, name.trim(), JSON.stringify(platforms), budget, start_date || null, end_date || null, brand_id || null]
    );
    const campaign = result.rows[0];
    await publishEvent('campaign.created', campaign);
    logger.info('campaign created', { id: campaign.id });
    return res.status(201).json(campaign);
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('invalid') || err.message.includes('cannot')) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('create campaign error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'campaign not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('get campaign error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PUT /api/campaigns/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'campaign not found' });
    const current = existing.rows[0];
    const name = req.body.name !== undefined ? req.body.name : current.name;
    const platforms = req.body.platforms !== undefined ? req.body.platforms : current.platforms;
    const budget = req.body.budget !== undefined ? req.body.budget : current.budget;
    const status = req.body.status !== undefined ? req.body.status : current.status;
    const start_date = req.body.start_date !== undefined ? req.body.start_date : current.start_date;
    const end_date = req.body.end_date !== undefined ? req.body.end_date : current.end_date;
    validate({ name, platforms, budget });
    if (!Object.values(CAMPAIGN_STATUSES).includes(status)) {
      return res.status(400).json({ error: `invalid status: ${status}` });
    }
    const result = await pool.query(
      `UPDATE campaigns SET name=$1, platforms=$2, budget=$3, status=$4, start_date=$5, end_date=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, JSON.stringify(platforms), budget, status, start_date, end_date, req.params.id]
    );
    const campaign = result.rows[0];
    await publishEvent('campaign.updated', campaign);
    return res.json(campaign);
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('invalid') || err.message.includes('cannot')) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('update campaign error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /api/campaigns/:id - soft delete by marking as completed
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query("UPDATE campaigns SET status='completed', updated_at=NOW() WHERE id=$1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'campaign not found' });
    return res.status(204).send();
  } catch (err) {
    logger.error('delete campaign error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/campaigns/:id/activate
router.post('/:id/activate', async (req, res) => {
  try {
    const result = await pool.query("UPDATE campaigns SET status='active', updated_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'campaign not found' });
    const campaign = result.rows[0];
    await publishEvent('campaign.activated', campaign);
    return res.json(campaign);
  } catch (err) {
    logger.error('activate campaign error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    const result = await pool.query("UPDATE campaigns SET status='paused', updated_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'campaign not found' });
    const campaign = result.rows[0];
    await publishEvent('campaign.paused', campaign);
    return res.json(campaign);
  } catch (err) {
    logger.error('pause campaign error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
