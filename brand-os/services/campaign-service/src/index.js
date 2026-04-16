'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const campaignsRouter = require('./routes/campaigns');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use('/api/campaigns', campaignsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'campaign-service' }));

app.listen(PORT, () => logger.info(`campaign-service running on port ${PORT}`));

module.exports = app;
