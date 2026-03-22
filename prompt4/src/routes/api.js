const express = require('express');
const { nanoid } = require('nanoid');
const {
  getAllUrls,
  findByCode,
  findByOriginalUrl,
  save,
} = require('../db');

const router = express.Router();

// POST /api/shorten
router.post('/shorten', (req, res) => {
  const { url, customCode, expiresIn } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, error: 'url is required' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  let code = customCode;

  if (code) {
    // Check for duplicate custom code
    const existing = findByCode(code);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Custom code already in use' });
    }
  } else {
    // Check if this original URL was already shortened
    const existingByUrl = findByOriginalUrl(url);
    if (existingByUrl) {
      const shortUrl = `${req.protocol}://${req.get('host')}/${existingByUrl.code}`;
      return res.json({
        success: true,
        code: existingByUrl.code,
        shortUrl,
        originalUrl: existingByUrl.originalUrl,
        expiresAt: existingByUrl.expiresAt,
        clicks: existingByUrl.clicks,
      });
    }
    code = nanoid(7);
  }

  const createdAt = new Date().toISOString();
  let expiresAt = null;
  if (expiresIn) {
    const hours = parseFloat(expiresIn);
    if (!isNaN(hours) && hours > 0) {
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }
  }

  const entry = {
    code,
    originalUrl: url,
    createdAt,
    expiresAt,
    clicks: 0,
  };

  save(entry);

  const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;

  return res.status(201).json({
    success: true,
    code,
    shortUrl,
    originalUrl: url,
    expiresAt,
    clicks: 0,
  });
});

// GET /api/urls
router.get('/urls', (req, res) => {
  const urls = getAllUrls();

  // Sort by createdAt descending (newest first)
  const sorted = urls.slice().sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const result = sorted.map(entry => ({
    ...entry,
    shortUrl: `${req.protocol}://${req.get('host')}/${entry.code}`,
  }));

  return res.json({ success: true, urls: result });
});

// GET /api/stats/:code
router.get('/stats/:code', (req, res) => {
  const { code } = req.params;
  const entry = findByCode(code);

  if (!entry) {
    return res.status(404).json({ success: false, error: 'Code not found' });
  }

  const shortUrl = `${req.protocol}://${req.get('host')}/${entry.code}`;
  const now = new Date().toISOString();
  const isExpired = entry.expiresAt ? entry.expiresAt <= now : false;

  return res.json({
    success: true,
    code: entry.code,
    shortUrl,
    originalUrl: entry.originalUrl,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    clicks: entry.clicks,
    isExpired,
  });
});

module.exports = router;
