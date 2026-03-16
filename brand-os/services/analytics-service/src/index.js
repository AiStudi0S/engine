'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const analyticsRouter = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/analytics', analyticsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'analytics-service' }));

app.listen(PORT, () => console.log(`analytics-service running on port ${PORT}`));
module.exports = app;
