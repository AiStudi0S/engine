'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'distribution-service' }));

app.post('/api/distribute', async (req, res) => {
  try {
    const { campaignId, content, platforms } = req.body;
    if (!campaignId || !content || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'campaignId, content, and platforms (non-empty array) are required' });
    }
    // TODO: route to platform-specific connectors
    const results = platforms.map((platform) => ({
      platform,
      status: 'queued',
      postId: `post_${Date.now()}_${platform}`,
    }));
    return res.status(202).json({ campaignId, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.listen(PORT, () => console.log(`distribution-service running on port ${PORT}`));
module.exports = app;
