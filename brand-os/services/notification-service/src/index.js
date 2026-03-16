'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

app.post('/api/notifications/send', async (req, res) => {
  try {
    const { userId, type, channel, message } = req.body;
    if (!userId || !type || !channel || !message) {
      return res.status(400).json({ error: 'userId, type, channel, and message are required' });
    }
    // TODO: route to push/email/SMS provider
    return res.status(202).json({
      notificationId: `notif_${Date.now()}`,
      userId,
      type,
      channel,
      status: 'queued',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/api/notifications/:userId', (_req, res) => {
  // TODO: fetch from Redis/DB
  return res.json({ notifications: [] });
});

app.listen(PORT, () => console.log(`notification-service running on port ${PORT}`));
module.exports = app;
