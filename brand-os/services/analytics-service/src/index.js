'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
require('dotenv').config();

const logger = require('./logger');
const createAnalyticsRouter = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', limiter);

// Single shared pool — used by both the HTTP routes and the Kafka consumer
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use('/api/analytics', createAnalyticsRouter(pool));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'analytics-service' }));

const kafka = new Kafka({ clientId: 'analytics-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') });
const consumer = kafka.consumer({ groupId: 'analytics-service-group' });

async function startKafkaConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'analytics.metrics', fromBeginning: false });
    await consumer.subscribe({ topic: 'campaign.events', fromBeginning: false });
    await consumer.subscribe({ topic: 'campaign.created', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          let campaignId, platform, eventType, metric, value, metadata;

          if (topic === 'analytics.metrics') {
            // Scheduler-service publishes payload fields at the top level
            // (e.g. { campaign_id, event_type, ..., _jobType, _jobId }).
            ({ campaign_id: campaignId, platform = 'unknown', event_type: eventType, metric, value = 0, metadata = {} } = data);
          } else if (topic === 'campaign.events' || topic === 'campaign.created') {
            const event = data.event || data.eventType || 'campaign_event';
            campaignId = data.data?.id || data.campaign_id;
            platform = data.data?.platform || null;
            eventType = event;
            metric = 'campaign_event';
            value = 1;
            metadata = data.data || {};
          }

          if (!campaignId || !eventType) return;

          await pool.query(
            'INSERT INTO analytics_events (campaign_id, platform, event_type, metric, value, metadata) VALUES ($1,$2,$3,$4,$5,$6)',
            [campaignId, platform, eventType, metric || eventType, value, JSON.stringify(metadata)]
          );
        } catch (err) {
          logger.error('analytics kafka message error', { error: err.message, topic });
        }
      },
    });
    logger.info('Analytics Kafka consumer started');
  } catch (err) {
    logger.error('Analytics Kafka consumer failed', { error: err.message });
  }
}

startKafkaConsumer();

app.listen(PORT, () => logger.info(`analytics-service running on port ${PORT}`));
module.exports = { app, pool };
