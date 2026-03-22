const express = require('express');
const cors = require('cors');
const path = require('path');
const { findByCode, incrementClicks, deleteExpired } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', require('./routes/api'));

// Redirect route: GET /:code
app.get('/:code', (req, res) => {
  const { code } = req.params;

  const entry = findByCode(code);

  if (!entry) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  // Check expiry
  if (entry.expiresAt && new Date(entry.expiresAt) <= new Date()) {
    return res.status(410).json({ error: 'This short URL has expired' });
  }

  // Increment click count
  incrementClicks(code);

  // 301 redirect to original URL
  return res.redirect(301, entry.originalUrl);
});

// Root route: serve index.html (handled by static middleware, but explicit fallback)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`URL Shortener running on port ${PORT}`);

  // Delete expired entries immediately on startup
  const deletedOnStart = deleteExpired();
  if (deletedOnStart > 0) {
    console.log(`Deleted ${deletedOnStart} expired entries on startup`);
  }

  // Run deleteExpired every hour
  setInterval(() => {
    const deleted = deleteExpired();
    if (deleted > 0) {
      console.log(`Deleted ${deleted} expired entries`);
    }
  }, 60 * 60 * 1000);
});

module.exports = app;
