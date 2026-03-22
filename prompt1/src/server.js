'use strict';

const express = require('express');
const path = require('path');
const storage = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/shorten
app.post('/api/shorten', (req, res) => {
  const { url, customCode, expiresIn } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  let code;
  try {
    code = storage.createShortUrl(url, customCode || null, expiresIn || null);
  } catch (err) {
    if (err.code === 'DUPLICATE_CODE') {
      return res.status(409).json({ error: 'Custom code already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }

  const entry = storage.getUrl(code);
  return res.status(201).json({
    code,
    shortUrl: `http://localhost:${PORT}/${code}`,
    originalUrl: entry.originalUrl,
    expiresAt: entry.expiresAt,
  });
});

// GET /api/urls
app.get('/api/urls', (req, res) => {
  const urls = storage.getAllUrls().map((entry) => ({
    code: entry.code,
    originalUrl: entry.originalUrl,
    shortUrl: `http://localhost:${PORT}/${entry.code}`,
    clicks: entry.clicks,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  }));
  return res.json(urls);
});

// GET /api/stats/:code
app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  const entry = storage.getUrl(code);

  if (!entry) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  return res.json({
    code: entry.code,
    originalUrl: entry.originalUrl,
    shortUrl: `http://localhost:${PORT}/${entry.code}`,
    clicks: entry.clicks,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  });
});

// DELETE /api/urls/:code
app.delete('/api/urls/:code', (req, res) => {
  const { code } = req.params;
  const deleted = storage.deleteUrl(code);

  if (!deleted) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  return res.status(204).send();
});

// GET / — serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GET /:code — redirect
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const entry = storage.getUrl(code);

  if (!entry) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  if (storage.isExpired(entry)) {
    return res.status(410).json({ error: 'Short URL has expired' });
  }

  storage.incrementClick(code);
  return res.redirect(302, entry.originalUrl);
});

app.listen(PORT, () => {
  console.log(`URL Shortener server running on port ${PORT}`);
});

module.exports = app;
