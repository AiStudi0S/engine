'use strict';

const express = require('express');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const { LEAD_STATUSES, LEAD_SOURCES } = require('../models/lead');
const logger = require('../logger');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const kafka = new Kafka({ clientId: 'crm-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') });
const consumer = kafka.consumer({ groupId: 'crm-service-group' });

async function startKafkaConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'leads.inbound', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const { email, name, company, phone, source = 'email', campaign_id, metadata = {} } = data;
          if (!email) return;
          // Atomic upsert — ux_leads_email_campaign_id and ux_leads_email_no_campaign partial indexes
          // enforce uniqueness. ON CONFLICT without an explicit target covers both partial indexes.
          const inserted = await pool.query(
            `INSERT INTO leads (id, email, name, company, phone, source, status, campaign_id, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT DO NOTHING`,
            [uuidv4(), email, name || null, company || null, phone || null, LEAD_SOURCES.includes(source) ? source : 'email', 'new', campaign_id || null, JSON.stringify(metadata)]
          );
          if (inserted.rowCount > 0) logger.info('lead created from kafka', { email });
        } catch (err) {
          logger.error('leads.inbound processing error', { error: err.message });
        }
      },
    });
    logger.info('CRM Kafka consumer started');
  } catch (err) {
    logger.error('CRM Kafka consumer failed to start', { error: err.message });
  }
}

startKafkaConsumer();

// GET /api/leads/stats - must come before /:id
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT status, COUNT(*)::int AS count FROM leads GROUP BY status"
    );
    const stats = {};
    result.rows.forEach((row) => { stats[row.status] = row.count; });
    return res.json({ stats });
  } catch (err) {
    logger.error('leads stats error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const { status, source, minScore, maxScore } = req.query;

    if (status && !Object.values(LEAD_STATUSES).includes(status)) {
      return res.status(400).json({ error: `invalid status: '${status}'. Must be one of: ${Object.values(LEAD_STATUSES).join(', ')}` });
    }

    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (source) { params.push(source); conditions.push(`source = $${params.length}`); }
    if (minScore !== undefined) {
      const minScoreParsed = parseInt(minScore, 10);
      if (isNaN(minScoreParsed)) return res.status(400).json({ error: 'minScore must be a valid integer' });
      params.push(minScoreParsed); conditions.push(`score >= $${params.length}`);
    }
    if (maxScore !== undefined) {
      const maxScoreParsed = parseInt(maxScore, 10);
      if (isNaN(maxScoreParsed)) return res.status(400).json({ error: 'maxScore must be a valid integer' });
      params.push(maxScoreParsed); conditions.push(`score <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM leads ${where}`, params);
    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({ leads: dataResult.rows, total: parseInt(countResult.rows[0].count, 10), page, limit });
  } catch (err) {
    logger.error('list leads error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/leads
router.post('/', async (req, res) => {
  try {
    const { email, name, company, phone, source, campaign_id, metadata = {}, score = 0 } = req.body;
    if (!email) return res.status(400).json({ error: 'lead email is required' });
    if (!source) return res.status(400).json({ error: 'source is required' });
    if (!LEAD_SOURCES.includes(source)) {
      return res.status(400).json({ error: `invalid source: ${source}. Must be one of: ${LEAD_SOURCES.join(', ')}` });
    }
    const scoreParsed = Number(score);
    if (!Number.isFinite(scoreParsed) || scoreParsed < 0 || scoreParsed > 100) {
      return res.status(400).json({ error: 'score must be a number between 0 and 100' });
    }
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO leads (id, email, name, company, phone, source, status, score, campaign_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [id, email, name || null, company || null, phone || null, source, 'new', scoreParsed, campaign_id || null, JSON.stringify(metadata)]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('create lead error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'lead not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('get lead error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await pool.query("SELECT * FROM leads WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'lead not found' });
    const PATCHABLE = ['status', 'score', 'name', 'company', 'phone', 'metadata'];
    const updates = {};
    PATCHABLE.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.status && !Object.values(LEAD_STATUSES).includes(updates.status)) {
      return res.status(400).json({ error: `invalid status: ${updates.status}` });
    }
    if (updates.score !== undefined) {
      const parsedScore = Number(updates.score);
      if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
        return res.status(400).json({ error: 'score must be a number between 0 and 100' });
      }
      updates.score = parsedScore;
    }
    // metadata is JSONB NOT NULL — coerce explicit null to an empty object
    if (updates.metadata === null) {
      updates.metadata = {};
    }
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    setClauses.push(`updated_at = NOW()`);
    // Only JSON-encode non-null objects (e.g. JSONB metadata); leave scalars and null as-is.
    const values = Object.values(updates).map((v) => (v !== null && typeof v === 'object') ? JSON.stringify(v) : v);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE leads SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('update lead error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /api/leads/:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query("UPDATE leads SET status='lost', updated_at=NOW() WHERE id=$1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'lead not found' });
    return res.status(204).send();
  } catch (err) {
    logger.error('delete lead error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PUT /api/leads/:id/score
router.put('/:id/score', async (req, res) => {
  try {
    const { score } = req.body;
    if (score === undefined) return res.status(400).json({ error: 'score is required' });
    const scoreParsed = Number(score);
    if (!Number.isFinite(scoreParsed) || scoreParsed < 0 || scoreParsed > 100) {
      return res.status(400).json({ error: 'score must be a number between 0 and 100' });
    }
    const result = await pool.query('UPDATE leads SET score=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [scoreParsed, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'lead not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('update lead score error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
