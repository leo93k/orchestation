const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store
const urlMap = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/shorten
app.post('/api/shorten', (req, res) => {
  const { url, customCode, ttl } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const code = customCode || Math.random().toString(36).slice(2, 8);

  if (urlMap.has(code)) {
    return res.status(409).json({ error: 'Code already in use' });
  }

  const createdAt = new Date();
  const expiresAt = ttl ? new Date(createdAt.getTime() + ttl * 60 * 1000) : null;

  urlMap.set(code, {
    original: url,
    clicks: 0,
    createdAt,
    expiresAt,
  });

  const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;
  res.json({ code, shortUrl, expiresAt });
});

// GET /api/urls
app.get('/api/urls', (req, res) => {
  const urls = [];
  for (const [code, data] of urlMap.entries()) {
    urls.push({ code, ...data });
  }
  res.json(urls);
});

// GET /:code - redirect
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const entry = urlMap.get(code);

  if (!entry) {
    return res.status(404).send('Not found');
  }

  if (entry.expiresAt && new Date() > entry.expiresAt) {
    return res.status(410).send('Gone - this link has expired');
  }

  entry.clicks += 1;
  res.redirect(entry.original);
});

app.listen(PORT, () => {
  console.log(`URL Shortener running on port ${PORT}`);
});
