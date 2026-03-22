const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

// Validate URL (only http/https)
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Validate custom code (alphanumeric only)
function isValidCode(code) {
  return /^[a-zA-Z0-9]+$/.test(code);
}

// POST /api/shorten - Create short URL
router.post('/shorten', (req, res) => {
  const { url, customCode, expiresIn } = req.body;

  if (!url) return res.status(400).json({ error: 'URL은 필수입니다.' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'http 또는 https URL만 허용됩니다.' });

  let shortCode;
  if (customCode) {
    if (!isValidCode(customCode)) {
      return res.status(400).json({ error: '커스텀 코드는 영문자와 숫자만 사용 가능합니다.' });
    }
    const existing = db.prepare('SELECT id FROM urls WHERE short_code = ?').get(customCode);
    if (existing) {
      return res.status(409).json({ error: '이미 사용 중인 커스텀 코드입니다.' });
    }
    shortCode = customCode;
  } else {
    shortCode = nanoid(6);
    // Ensure uniqueness
    while (db.prepare('SELECT id FROM urls WHERE short_code = ?').get(shortCode)) {
      shortCode = nanoid(6);
    }
  }

  let expiresAt = null;
  if (expiresIn && parseInt(expiresIn) > 0) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(expiresIn));
    expiresAt = d.toISOString();
  }

  db.prepare(
    'INSERT INTO urls (original_url, short_code, expires_at) VALUES (?, ?, ?)'
  ).run(url, shortCode, expiresAt);

  res.json({ shortCode, shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}` });
});

// GET /api/urls - List all URLs
router.get('/urls', (req, res) => {
  const rows = db.prepare(
    'SELECT id, original_url, short_code, click_count, expires_at, created_at FROM urls ORDER BY created_at DESC LIMIT 100'
  ).all();
  res.json(rows);
});

// DELETE /api/urls/:code - Delete a URL
router.delete('/urls/:code', (req, res) => {
  const result = db.prepare('DELETE FROM urls WHERE short_code = ?').run(req.params.code);
  if (result.changes === 0) return res.status(404).json({ error: '존재하지 않는 코드입니다.' });
  res.json({ success: true });
});

module.exports = router;
