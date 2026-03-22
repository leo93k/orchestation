const express = require('express');
const path = require('path');
const urlModel = require('./url-model');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cleanup expired URLs every 5 minutes
setInterval(() => urlModel.cleanupExpired(), 5 * 60 * 1000);

// === API Routes ===

// Create short URL
app.post('/api/urls', (req, res) => {
  try {
    const { url, customAlias, expiresInMinutes } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Custom alias validation
    if (customAlias && !/^[a-zA-Z0-9_-]{3,30}$/.test(customAlias)) {
      return res.status(400).json({ error: 'Custom alias must be 3-30 chars (letters, numbers, _ , -)' });
    }

    const record = urlModel.createShortUrl({
      originalUrl: url,
      customAlias: customAlias || null,
      expiresInMinutes: expiresInMinutes || null,
    });

    res.status(201).json({
      shortCode: record.short_code,
      shortUrl: `${req.protocol}://${req.get('host')}/${record.short_code}`,
      originalUrl: record.original_url,
      expiresAt: record.expires_at,
      createdAt: record.created_at,
    });
  } catch (err) {
    if (err.message.includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List all URLs
app.get('/api/urls', (_req, res) => {
  const urls = urlModel.listAll();
  res.json(urls.map(u => ({
    shortCode: u.short_code,
    originalUrl: u.original_url,
    clicks: u.clicks,
    expiresAt: u.expires_at,
    createdAt: u.created_at,
    isCustom: !!u.custom_alias,
  })));
});

// Get stats for a short URL
app.get('/api/urls/:code/stats', (req, res) => {
  const record = urlModel.findByCode(req.params.code);
  if (!record) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({
    shortCode: record.short_code,
    originalUrl: record.original_url,
    clicks: record.clicks,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
    isCustom: !!record.custom_alias,
  });
});

// === Redirect ===
app.get('/:code', (req, res) => {
  const record = urlModel.findByCode(req.params.code);

  if (!record) {
    return res.status(404).send('Short URL not found');
  }

  // Check expiration
  if (record.expires_at) {
    const now = new Date();
    const expires = new Date(record.expires_at.replace(' ', 'T') + 'Z');
    if (now > expires) {
      return res.status(410).send('This short URL has expired');
    }
  }

  urlModel.recordClick(record.short_code);
  res.redirect(301, record.original_url);
});

app.listen(PORT, () => {
  console.log(`URL Shortener running at http://localhost:${PORT}`);
});
