'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const webpush = require('web-push');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@brandos.ai',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendEmailNotification(notification) {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('SendGrid not configured, skipping email');
    return false;
  }
  try {
    await sgMail.send({
      to: notification.metadata?.email || notification.metadata?.to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@brandos.ai',
      subject: notification.title,
      text: notification.body,
      html: notification.metadata?.html || `<p>${escapeHtml(notification.body)}</p>`,
    });
    return true;
  } catch (err) {
    logger.error('SendGrid send error', { error: err.message });
    return false;
  }
}

async function sendPushNotification(notification) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    logger.warn('VAPID keys not configured, skipping push');
    return false;
  }
  const subscription = notification.metadata?.subscription;
  if (!subscription) {
    logger.warn('no push subscription provided');
    return false;
  }
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: notification.title, body: notification.body, data: notification.metadata })
    );
    return true;
  } catch (err) {
    logger.error('web-push error', { error: err.message });
    return false;
  }
}

async function processNotification(notification) {
  let success = false;
  try {
    if (notification.channel === 'email') {
      success = await sendEmailNotification(notification);
    } else if (notification.channel === 'push') {
      success = await sendPushNotification(notification);
    } else if (notification.channel === 'sms') {
      logger.warn('SMS channel not yet implemented');
      success = false;
    }
    const status = success ? 'sent' : 'failed';
    await pool.query("UPDATE notifications SET status=$1 WHERE id=$2", [status, notification.id]);
    return status;
  } catch (err) {
    logger.error('processNotification error', { error: err.message });
    await pool.query("UPDATE notifications SET status='failed' WHERE id=$1", [notification.id]);
    return 'failed';
  }
}

const kafka = new Kafka({ clientId: 'notification-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',') });
const consumer = kafka.consumer({ groupId: 'notification-service-group' });

async function startKafkaConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'notifications.send', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const { user_id, type, channel, title, body, metadata = {} } = data;
          if (!user_id || !channel || !title) return;
          const allowed_channels = ['email', 'push', 'sms'];
          if (!allowed_channels.includes(channel)) return;
          const id = uuidv4();
          await pool.query(
            'INSERT INTO notifications (id, user_id, type, channel, title, body, status, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [id, user_id, type || 'general', channel, title, body || '', 'pending', JSON.stringify(metadata)]
          );
          const notification = { id, user_id, type, channel, title, body, metadata };
          await processNotification(notification);
        } catch (err) {
          logger.error('notifications.send processing error', { error: err.message });
        }
      },
    });
    logger.info('Notification Kafka consumer started');
  } catch (err) {
    logger.error('Notification Kafka consumer failed', { error: err.message });
  }
}

startKafkaConsumer();

// POST /api/notifications
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_id, type, channel, title, body, metadata = {} } = req.body;
    if (!user_id || !channel || !title || !body) {
      return res.status(400).json({ error: 'user_id, channel, title, and body are required' });
    }
    const allowed_channels = ['email', 'push', 'sms'];
    if (!allowed_channels.includes(channel)) {
      return res.status(400).json({ error: `channel must be one of: ${allowed_channels.join(', ')}` });
    }
    const id = uuidv4();
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, channel, title, body, status, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, user_id, type || 'general', channel, title, body, 'pending', JSON.stringify(metadata)]
    );
    const notification = { id, user_id, type, channel, title, body, metadata };
    const status = await processNotification(notification);
    return res.status(201).json({ id, user_id, type, channel, title, body, status });
  } catch (err) {
    logger.error('create notification error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    if (user_id) { params.push(user_id); conditions.push(`user_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) FROM notifications ${where}`, params.slice(0, -2));
    return res.json({ notifications: result.rows, total: parseInt(count.rows[0].count, 10), page, limit });
  } catch (err) {
    logger.error('list notifications error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/notifications/:id
app.get('/api/notifications/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'notification not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('get notification error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PUT /api/notifications/:id/read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE notifications SET metadata = metadata || '{\"read\": true}'::jsonb WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'notification not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('mark read error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.listen(PORT, () => logger.info(`notification-service running on port ${PORT}`));
module.exports = app;
