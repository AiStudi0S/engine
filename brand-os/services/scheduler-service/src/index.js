'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Queue, Worker, QueueEvents } = require('bullmq');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisUrl = new URL(REDIS_URL);
const connection = { host: redisUrl.hostname, port: parseInt(redisUrl.port || '6379', 10) };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const kafka = new Kafka({ clientId: 'scheduler-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') });
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

const JOB_QUEUE_NAME = 'brand-os-jobs';
const queue = new Queue(JOB_QUEUE_NAME, { connection });

const KAFKA_TOPIC_MAP = {
  publish_campaign: 'campaign.publish',
  send_notification: 'notifications.send',
  generate_report: 'analytics.metrics',
  sync_analytics: 'analytics.metrics',
};

const worker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    logger.info('processing job', { jobType: job.data.jobType, jobId: job.id });
    const { jobType, payload, dbJobId } = job.data;

    await pool.query("UPDATE scheduled_jobs SET status='running', updated_at=NOW() WHERE id=$1", [dbJobId]).catch(() => {});

    const topic = KAFKA_TOPIC_MAP[jobType] || 'analytics.metrics';
    if (producerReady) {
      await producer.send({
        topic,
        messages: [{ key: dbJobId, value: JSON.stringify({ jobType, payload, jobId: dbJobId, timestamp: new Date().toISOString() }) }],
      });
    }

    await pool.query(
      "UPDATE scheduled_jobs SET status='completed', result=$1, updated_at=NOW() WHERE id=$2",
      [JSON.stringify({ topic, timestamp: new Date().toISOString() }), dbJobId]
    ).catch(() => {});

    return { success: true };
  },
  { connection }
);

worker.on('failed', async (job, err) => {
  logger.error('job failed', { jobId: job?.id, error: err.message });
  if (job?.data?.dbJobId) {
    await pool.query(
      "UPDATE scheduled_jobs SET status='failed', error=$1, updated_at=NOW() WHERE id=$2",
      [err.message, job.data.dbJobId]
    ).catch(() => {});
  }
});

// POST /api/schedules
app.post('/api/schedules', async (req, res) => {
  try {
    const { type, payload = {}, scheduledAt, cronExpression } = req.body;
    const VALID_TYPES = ['publish_campaign', 'send_notification', 'generate_report', 'sync_analytics'];
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (!scheduledAt && !cronExpression) {
      return res.status(400).json({ error: 'scheduledAt or cronExpression is required' });
    }

    const dbJobId = uuidv4();
    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : new Date();

    await pool.query(
      'INSERT INTO scheduled_jobs (id, job_type, payload, scheduled_at, status) VALUES ($1,$2,$3,$4,$5)',
      [dbJobId, type, JSON.stringify(payload), scheduledAtDate, 'pending']
    );

    const delay = scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0;
    const jobOptions = cronExpression ? { repeat: { pattern: cronExpression } } : { delay };

    const bullJob = await queue.add(type, { jobType: type, payload, dbJobId }, jobOptions);

    return res.status(201).json({ id: dbJobId, bullJobId: bullJob.id, type, payload, scheduledAt: scheduledAtDate, status: 'pending' });
  } catch (err) {
    logger.error('create schedule error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/schedules
app.get('/api/schedules', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT * FROM scheduled_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const count = await pool.query('SELECT COUNT(*) FROM scheduled_jobs');
    return res.json({ jobs: result.rows, total: parseInt(count.rows[0].count, 10), page, limit });
  } catch (err) {
    logger.error('list schedules error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/schedules/:id/status
app.get('/api/schedules/:id/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scheduled_jobs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'job not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('get schedule status error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /api/schedules/:id
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const result = await pool.query("UPDATE scheduled_jobs SET status='failed', error='cancelled by user', updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'job not found or not cancellable' });
    return res.status(204).send();
  } catch (err) {
    logger.error('delete schedule error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'scheduler-service' }));

app.listen(PORT, () => logger.info(`scheduler-service running on port ${PORT}`));

module.exports = app;
