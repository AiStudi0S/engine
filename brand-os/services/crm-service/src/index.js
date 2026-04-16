'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const leadsRouter = require('./routes/leads');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3007;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use('/api/leads', leadsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'crm-service' }));

app.listen(PORT, () => logger.info(`crm-service running on port ${PORT}`));
module.exports = app;
