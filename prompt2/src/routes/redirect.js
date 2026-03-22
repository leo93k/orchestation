const express = require('express');
const router = express.Router();
const { findByCode, incrementClicks } = require('../database');

// GET /:code - 리디렉션 처리
router.get('/:code', (req, res) => {
  try {
    const code = req.params.code;
    const url = findByCode(code);

    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head><meta charset="UTF-8"><title>404 - Not Found</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5;}
        .box{text-align:center;padding:2rem;}.box h1{font-size:4rem;color:#e74c3c;margin:0;}.box p{color:#666;}.box a{color:#3498db;}</style></head>
        <body><div class="box"><h1>404</h1><p>단축 URL을 찾을 수 없습니다.</p><a href="/">홈으로 돌아가기</a></div></body></html>
      `);
    }

    // 만료 확인
    if (url.expires_at && new Date(url.expires_at) < new Date()) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head><meta charset="UTF-8"><title>410 - Expired</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5;}
        .box{text-align:center;padding:2rem;}.box h1{font-size:4rem;color:#f39c12;margin:0;}.box p{color:#666;}.box a{color:#3498db;}</style></head>
        <body><div class="box"><h1>410</h1><p>이 단축 URL은 만료되었습니다.</p><a href="/">홈으로 돌아가기</a></div></body></html>
      `);
    }

    // 클릭 수 증가
    incrementClicks(code);

    // 리디렉션
    res.redirect(301, url.original_url);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
