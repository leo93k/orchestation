const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'urls.json');

// In-memory store
const urlMap = new Map();

// Load persisted data on startup
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const entries = JSON.parse(raw);
      for (const entry of entries) {
        urlMap.set(entry.shortCode, entry);
      }
      console.log(`Loaded ${urlMap.size} URLs from storage.`);
    }
  } catch (err) {
    console.error('Failed to load data file:', err.message);
  }
}

// Save in-memory data to disk
function saveData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const entries = Array.from(urlMap.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data file:', err.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/shorten
app.post('/api/shorten', (req, res) => {
  const { url, customCode, expiresInDays } = req.body;

  if (!url || !/^https?:\/\/.+/.test(url)) {
    return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
  }

  const shortCode = customCode || nanoid(6);

  if (urlMap.has(shortCode)) {
    return res.status(409).json({ error: 'Short code already exists' });
  }

  const now = new Date();
  const expiresAt = expiresInDays
    ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const entry = {
    shortCode,
    originalUrl: url,
    clicks: 0,
    createdAt: now.toISOString(),
    expiresAt,
  };

  urlMap.set(shortCode, entry);
  saveData();

  return res.status(201).json({
    shortCode,
    shortUrl: `http://localhost:${PORT}/${shortCode}`,
    originalUrl: entry.originalUrl,
    clicks: entry.clicks,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  });
});

// GET /api/urls
app.get('/api/urls', (req, res) => {
  const now = new Date();
  const entries = Array.from(urlMap.values())
    .map((entry) => ({
      ...entry,
      expired: entry.expiresAt ? new Date(entry.expiresAt) < now : false,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json(entries);
});

// GET /api/stats/:code
app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  const entry = urlMap.get(code);

  if (!entry) {
    return res.status(404).json({ error: 'Short code not found' });
  }

  const now = new Date();
  return res.json({
    ...entry,
    expired: entry.expiresAt ? new Date(entry.expiresAt) < now : false,
  });
});

// DELETE /api/urls/:code
app.delete('/api/urls/:code', (req, res) => {
  const { code } = req.params;

  if (!urlMap.has(code)) {
    return res.status(404).json({ error: 'Short code not found' });
  }

  urlMap.delete(code);
  saveData();

  return res.json({ message: 'Deleted successfully' });
});

// GET /:code — redirect
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const entry = urlMap.get(code);

  if (!entry) {
    return res.status(404).json({ error: 'Short code not found' });
  }

  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'URL expired' });
  }

  entry.clicks += 1;
  urlMap.set(code, entry);
  saveData();

  return res.redirect(302, entry.originalUrl);
});

// Start server
loadData();
app.listen(PORT, () => {
  console.log(`URL Shortener running on port ${PORT}`);
});

module.exports = app;
