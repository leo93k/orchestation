const express = require('express');
const path = require('path');
const db = require('./db');
const urlsRouter = require('./routes/urls');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', urlsRouter);

// GET /:code - redirect handler
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const entry = db.findByCode(code);

  if (!entry) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  if (entry.expiresAt && new Date(entry.expiresAt) <= new Date()) {
    return res.status(404).json({ error: 'Short URL has expired' });
  }

  db.incrementClick(code);
  return res.redirect(301, entry.originalUrl);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
