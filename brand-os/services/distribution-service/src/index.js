'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const logger = require('./logger');
const TwitterConnector = require('./connectors/social/twitter');
const InstagramConnector = require('./connectors/social/instagram');
const SendGridConnector = require('./connectors/email/sendgrid');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const connectors = {
  x: new TwitterConnector(),
  twitter: new TwitterConnector(),
  instagram: new InstagramConnector(),
  email: new SendGridConnector(),
};

const kafka = new Kafka({ clientId: 'distribution-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') });
const consumer = kafka.consumer({ groupId: 'distribution-service-group' });
const producer = kafka.producer();
let producerReady = false;

async function savePost(campaignId, platform, content, status, externalId = null) {
  try {
    const result = await pool.query(
      `INSERT INTO content_posts (id, campaign_id, platform, content, status, external_id, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uuidv4(), campaignId, platform, JSON.stringify(content), status, externalId, status === 'published' ? new Date() : null]
    );
    return result.rows[0];
  } catch (err) {
    logger.error('save post error', { error: err.message });
    return null;
  }
}

async function distributeToPlatform(platform, content, campaignId) {
  const canonicalPlatform = platform === 'twitter' ? 'x' : platform;
  const connector = connectors[canonicalPlatform];
  if (!connector) {
    logger.warn('no connector for platform', { platform });
    return { platform, status: 'failed', error: `no connector for platform: ${platform}` };
  }
  try {
    const result = await connector.publish(content);
    const post = await savePost(campaignId, canonicalPlatform, content, 'published', result.id || result.messageId);
    if (producerReady) {
      await producer.send({
        topic: 'analytics.metrics',
        messages: [{ value: JSON.stringify({ campaign_id: campaignId, platform: canonicalPlatform, event_type: 'post_published', metric: 'posts', value: 1, metadata: result }) }],
      });
    }
    return { platform: canonicalPlatform, status: 'published', externalId: result.id || result.messageId, postDbId: post?.id };
  } catch (err) {
    logger.error('distribution error', { platform, error: err.message });
    await savePost(campaignId, canonicalPlatform, content, 'failed');
    return { platform: canonicalPlatform, status: 'failed', error: err.message };
  }
}

async function startKafkaConsumer() {
  try {
    await producer.connect();
    producerReady = true;
    await consumer.connect();
    await consumer.subscribe({ topic: 'campaign.publish', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const { campaignId, campaign_id, platforms = [], content } = data.payload || data;
          const cid = campaignId || campaign_id;
          if (!cid || !content) return;
          logger.info('processing campaign.publish', { campaignId: cid, platforms });
          await Promise.all(platforms.map((p) => distributeToPlatform(p, content, cid)));
        } catch (err) {
          logger.error('campaign.publish processing error', { error: err.message });
        }
      },
    });
    logger.info('Distribution Kafka consumer started');
  } catch (err) {
    logger.error('Distribution Kafka setup failed', { error: err.message });
  }
}

startKafkaConsumer();

// POST /api/distribute
app.post('/api/distribute', async (req, res) => {
  try {
    const { campaignId, content, platforms } = req.body;
    if (!campaignId || !content || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'campaignId, content, and platforms (non-empty array) are required' });
    }
    const results = await Promise.all(platforms.map((p) => distributeToPlatform(p, content, campaignId)));
    return res.status(202).json({ campaignId, results });
  } catch (err) {
    logger.error('distribute error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/distribute/:id/status
app.get('/api/distribute/:id/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM content_posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'post not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('get distribute status error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'distribution-service' }));

app.listen(PORT, () => logger.info(`distribution-service running on port ${PORT}`));
module.exports = app;
