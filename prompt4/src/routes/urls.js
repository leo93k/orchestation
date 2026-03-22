const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

// POST /api/shorten
router.post('/shorten', (req, res) => {
  const { originalUrl, customCode, expiresInDays } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ error: 'originalUrl is required' });
  }

  const shortCode = customCode || nanoid(7);

  if (customCode && db.isCodeTaken(customCode)) {
    return res.status(409).json({ error: 'Custom code already in use' });
  }

  let expiresAt = null;
  if (expiresInDays) {
    const date = new Date();
    date.setDate(date.getDate() + Number(expiresInDays));
    expiresAt = date.toISOString();
  }

  const entry = db.create({ shortCode, originalUrl, expiresAt });
  const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;

  return res.status(201).json({
    shortCode: entry.shortCode,
    shortUrl,
    originalUrl: entry.originalUrl,
    expiresAt: entry.expiresAt,
  });
});

// GET /api/urls
router.get('/urls', (req, res) => {
  const entries = db.findAll();
  return res.json(entries);
});

// GET /api/urls/:code/stats
router.get('/urls/:code/stats', (req, res) => {
  const entry = db.findByCode(req.params.code);
  if (!entry) {
    return res.status(404).json({ error: 'Short code not found' });
  }
  return res.json({
    shortCode: entry.shortCode,
    originalUrl: entry.originalUrl,
    clicks: entry.clicks,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  });
});

module.exports = router;
