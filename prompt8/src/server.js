const express = require('express');
const path = require('path');
const db = require('./db');
const urlsRouter = require('./routes/urls');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/urls', urlsRouter);

// Redirect handler - must be after API routes
app.get('/:code', (req, res) => {
  const { code } = req.params;
  if (!/^[a-zA-Z0-9]+$/.test(code)) return res.status(400).send('잘못된 요청입니다.');

  const row = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(code);
  if (!row) return res.status(404).send('존재하지 않는 단축 URL입니다.');

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(410).send('만료된 URL입니다.');
  }

  db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?').run(code);
  res.redirect(301, row.original_url);
});

app.listen(PORT, () => {
  console.log(`URL 단축 서비스가 포트 ${PORT}에서 실행 중입니다.`);
});
