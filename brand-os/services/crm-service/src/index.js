'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const leadsRouter = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 3007;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/leads', leadsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'crm-service' }));

app.listen(PORT, () => console.log(`crm-service running on port ${PORT}`));
module.exports = app;
