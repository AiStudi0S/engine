'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../config');

const router = express.Router();

// In-memory user store (replace with PostgreSQL in production)
// TODO: migrate to PostgreSQL — see brand-os/services/auth-service/src/db/users.js
const users = new Map();

const MIN_PASSWORD_LENGTH = 8;

router.post('/register', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (users.has(email)) {
      return res.status(409).json({ error: 'email already registered' });
    }
    const hash = await bcrypt.hash(password, 12);
    users.set(email, { email, hash, role: 'user' });
    const token = jwt.sign({ email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.hash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/refresh', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const newToken = jwt.sign({ email: decoded.email, role: decoded.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token: newToken });
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
});

module.exports = router;
