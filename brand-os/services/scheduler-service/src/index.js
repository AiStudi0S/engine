'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'scheduler-service' }));

app.post('/api/jobs/schedule', async (req, res) => {
  try {
    const { campaignId, scheduleAt, type } = req.body;
    if (!campaignId || !scheduleAt || !type) {
      return res.status(400).json({ error: 'campaignId, scheduleAt, and type are required' });
    }
    // TODO: enqueue via BullMQ
    return res.status(201).json({ jobId: `job_${Date.now()}`, campaignId, scheduleAt, type, status: 'queued' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/api/jobs', (_req, res) => {
  // TODO: fetch from BullMQ
  return res.json({ jobs: [] });
});

app.listen(PORT, () => console.log(`scheduler-service running on port ${PORT}`));
module.exports = app;
