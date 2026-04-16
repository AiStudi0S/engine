'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

const { JWT_SECRET, DATABASE_URL } = require('../config');
const { authenticate } = require('../middleware/jwt');
const logger = require('../logger');

const router = express.Router();

const pool = new Pool({ connectionString: DATABASE_URL });

const MIN_PASSWORD_LENGTH = 8;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

function generateAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

async function storeRefreshToken(userId, rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hash, expiresAt]
  );
  return rawToken;
}

router.post('/register', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    const role = 'creator'; // always default; role elevation requires an authenticated admin endpoint
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'email already registered' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, password_hash, role]
    );
    const user = result.rows[0];
    const accessToken = generateAccessToken(user);
    const rawRefresh = crypto.randomBytes(40).toString('hex');
    await storeRefreshToken(user.id, rawRefresh);
    return res.status(201).json({ access_token: accessToken, refresh_token: rawRefresh, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    // Race-condition guard: if two requests slip past the SELECT, catch the unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email already registered' });
    }
    logger.error('[auth] register error', { error: err.message });
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
    const result = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const accessToken = generateAccessToken(user);
    const rawRefresh = crypto.randomBytes(40).toString('hex');
    await storeRefreshToken(user.id, rawRefresh);
    return res.json({ access_token: accessToken, refresh_token: rawRefresh, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    logger.error('[auth] login error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    // Perform the entire lookup + expiry check + rotation atomically on one connection
    // to prevent concurrent reuse of the same refresh token.
    const client = await pool.connect();
    let accessToken, newRawRefresh;
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT rt.id, rt.user_id, rt.expires_at, u.email, u.role FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1 FOR UPDATE',
        [hash]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(401).json({ error: 'invalid refresh token' });
      }
      const row = result.rows[0];
      if (new Date(row.expires_at) < new Date()) {
        await client.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
        await client.query('COMMIT');
        return res.status(401).json({ error: 'refresh token expired' });
      }

      accessToken = generateAccessToken({ id: row.user_id, email: row.email, role: row.role });

      // Rotate: delete old token, insert new one
      newRawRefresh = crypto.randomBytes(40).toString('hex');
      const newHash = crypto.createHash('sha256').update(newRawRefresh).digest('hex');
      const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

      const deleteResult = await client.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
      if (deleteResult.rowCount !== 1) {
        // Token was already consumed by a concurrent request
        await client.query('ROLLBACK');
        return res.status(401).json({ error: 'refresh token already used' });
      }
      await client.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [row.user_id, newHash, newExpiresAt]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch((rbErr) => {
        logger.warn('[auth] ROLLBACK failed after rotation error', { error: rbErr.message });
      });
      logger.error('[auth] refresh token rotation error', { error: txErr.message });
      return res.status(500).json({ error: 'internal server error' });
    } finally {
      client.release();
    }

    return res.json({ access_token: accessToken, refresh_token: newRawRefresh });
  } catch (err) {
    logger.error('[auth] refresh error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]);
    return res.json({ message: 'logged out' });
  } catch (err) {
    logger.error('[auth] logout error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.sub]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'user not found' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('[auth] me error', { error: err.message });
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
