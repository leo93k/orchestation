const express = require('express');
const path = require('path');
const db = require('./db');
const urlRoutes = require('./routes/urls');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', urlRoutes);

// Redirect handler
app.get('/:code', (req, res) => {
  const { code } = req.params;

  // Skip if it looks like a static file or api
  if (code === 'favicon.ico') return res.status(404).end();

  const row = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(code);

  if (!row) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Check expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: '만료된 URL입니다.' });
  }

  // Increment click count
  db.prepare('UPDATE urls SET click_count = click_count + 1 WHERE short_code = ?').run(code);

  return res.redirect(301, row.original_url);
});

app.listen(PORT, () => {
  console.log(`URL Shortener running on port ${PORT}`);
});
