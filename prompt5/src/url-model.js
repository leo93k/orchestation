const db = require('./db');
const { nanoid } = require('nanoid');

const SHORT_CODE_LENGTH = 7;

const stmts = {
  insert: db.prepare(`
    INSERT INTO urls (short_code, original_url, custom_alias, expires_at)
    VALUES (@short_code, @original_url, @custom_alias, @expires_at)
  `),
  findByCode: db.prepare(`SELECT * FROM urls WHERE short_code = ?`),
  incrementClicks: db.prepare(`UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?`),
  listAll: db.prepare(`SELECT * FROM urls ORDER BY created_at DESC`),
  deleteExpired: db.prepare(`DELETE FROM urls WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`),
};

function createShortUrl({ originalUrl, customAlias, expiresInMinutes }) {
  const shortCode = customAlias || nanoid(SHORT_CODE_LENGTH);

  // Check duplicate
  const existing = stmts.findByCode.get(shortCode);
  if (existing) {
    throw new Error(`Short code "${shortCode}" already exists`);
  }

  let expiresAt = null;
  if (expiresInMinutes && expiresInMinutes > 0) {
    const d = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    expiresAt = d.toISOString().replace('T', ' ').slice(0, 19);
  }

  stmts.insert.run({
    short_code: shortCode,
    original_url: originalUrl,
    custom_alias: customAlias ? 1 : 0,
    expires_at: expiresAt,
  });

  return stmts.findByCode.get(shortCode);
}

function findByCode(shortCode) {
  return stmts.findByCode.get(shortCode);
}

function recordClick(shortCode) {
  stmts.incrementClicks.run(shortCode);
}

function listAll() {
  return stmts.listAll.all();
}

function cleanupExpired() {
  return stmts.deleteExpired.run();
}

module.exports = { createShortUrl, findByCode, recordClick, listAll, cleanupExpired };
