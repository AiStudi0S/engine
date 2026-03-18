'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const campaignsRouter = require('./routes/campaigns');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/campaigns', campaignsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'campaign-service' }));

app.listen(PORT, () => {
  console.log(`campaign-service running on port ${PORT}`);
});

module.exports = app;
