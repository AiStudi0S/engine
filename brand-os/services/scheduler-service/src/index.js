'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Queue, Worker } = require('bullmq');
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

async function connectKafkaProducer(retries = 6, baseDelayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await producer.connect();
      producerReady = true;
      logger.info('Kafka producer connected');
      return;
    } catch (err) {
      logger.error(`Kafka producer connection failed (attempt ${attempt}/${retries})`, { error: err.message });
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
      }
    }
  }
  logger.error('Kafka producer could not connect after all retries — exiting so container restarts and recovers');
  process.exit(1);
}

connectKafkaProducer();

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

    await pool.query("UPDATE scheduled_jobs SET status='running', updated_at=NOW() WHERE id=$1", [dbJobId]).catch((e) => {
      logger.warn('failed to update job status to running', { dbJobId, error: e.message });
    });

    const topic = KAFKA_TOPIC_MAP[jobType] || 'analytics.metrics';
    if (!producerReady) {
      throw new Error('Kafka producer not ready — cannot publish job event');
    }
    // Publish payload fields at the top level so downstream consumers (notification-service,
    // analytics-service) can read them without unwrapping. Job metadata is included under _ prefixed keys.
    await producer.send({
      topic,
      messages: [{ key: dbJobId, value: JSON.stringify({ ...payload, _jobType: jobType, _jobId: dbJobId, _timestamp: new Date().toISOString() }) }],
    });

    await pool.query(
      "UPDATE scheduled_jobs SET status='completed', result=$1, updated_at=NOW() WHERE id=$2",
      [JSON.stringify({ topic, timestamp: new Date().toISOString() }), dbJobId]
    ).catch((e) => {
      logger.warn('failed to update job status to completed', { dbJobId, error: e.message });
    });

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
    ).catch((e) => {
      logger.warn('failed to update job status to failed', { dbJobId: job.data.dbJobId, error: e.message });
    });
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

    if (cronExpression) {
      // Validate cron pattern: must have 5 or 6 space-separated fields
      const cronParts = cronExpression.trim().split(/\s+/);
      if (cronParts.length < 5 || cronParts.length > 6) {
        return res.status(400).json({ error: 'cronExpression must be a valid cron pattern (5 or 6 fields)' });
      }
    }

    const dbJobId = uuidv4();
    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : new Date();
    if (scheduledAt && isNaN(scheduledAtDate.getTime())) {
      return res.status(400).json({ error: 'scheduledAt must be a valid ISO 8601 timestamp' });
    }

    await pool.query(
      'INSERT INTO scheduled_jobs (id, job_type, payload, scheduled_at, status) VALUES ($1,$2,$3,$4,$5)',
      [dbJobId, type, JSON.stringify(payload), scheduledAtDate, 'pending']
    );

    const delay = scheduledAt ? Math.max(0, scheduledAtDate.getTime() - Date.now()) : 0;
    const jobOptions = cronExpression ? { repeat: { pattern: cronExpression } } : { delay };

    const bullJob = await queue.add(type, { jobType: type, payload, dbJobId }, jobOptions);

    // For cron (repeatable) jobs, store the stable repeat key; for delayed jobs store the job ID.
    // BullMQ repeatable job IDs change on each run, but the repeat key is stable.
    const bullJobIdToStore = cronExpression
      ? (bullJob.opts?.repeat?.key || String(bullJob.id))
      : String(bullJob.id);
    await pool.query('UPDATE scheduled_jobs SET bull_job_id=$1 WHERE id=$2', [bullJobIdToStore, dbJobId]).catch((e) => {
      logger.warn('failed to persist bull_job_id — job cancellation may be unreliable', { dbJobId, error: e.message });
    });

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
    const existing = await pool.query(
      "SELECT id, bull_job_id FROM scheduled_jobs WHERE id=$1 AND status='pending'",
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'job not found or not cancellable' });
    }

    // Remove from BullMQ to prevent execution
    const { bull_job_id } = existing.rows[0];
    if (bull_job_id) {
      try {
        // Try removing as a normal (delayed) job first
        const bullJob = await queue.getJob(bull_job_id);
        if (bullJob) {
          await bullJob.remove();
        } else {
          // If not found as a regular job, attempt to remove as a repeatable
          const repeatableJobs = await queue.getRepeatableJobs();
          const repeatKey = repeatableJobs.find((j) => j.id === bull_job_id || j.key === bull_job_id)?.key;
          if (repeatKey) {
            await queue.removeRepeatableByKey(repeatKey);
          }
        }
      } catch (bullErr) {
        logger.warn('could not remove BullMQ job', { bull_job_id, error: bullErr.message });
      }
    }

    await pool.query(
      "UPDATE scheduled_jobs SET status='failed', error='cancelled by user', updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    return res.status(204).send();
  } catch (err) {
    logger.error('delete schedule error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'scheduler-service' }));

app.listen(PORT, () => logger.info(`scheduler-service running on port ${PORT}`));

module.exports = app;
