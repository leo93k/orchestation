const crypto = require('crypto');
const { getDatabase } = require('../db/database');
const { generateUniqueCode, validateCustomSlug } = require('./shortcode');
const config = require('../config');

/**
 * @typedef {Object} CreateUrlParams
 * @property {string} url - The original URL to shorten
 * @property {string} [customSlug] - Optional custom slug
 * @property {number} [expiresInMinutes] - Optional expiration in minutes from now
 */

/**
 * @typedef {Object} UrlRecord
 * @property {number} id
 * @property {string} code
 * @property {string} original_url
 * @property {number} is_custom
 * @property {number} clicks
 * @property {string} created_at
 * @property {string|null} expires_at
 * @property {string|null} last_clicked_at
 */

// Prepared statements cache (lazily initialized)
let stmts = null;

function getStatements() {
  if (stmts) return stmts;
  const db = getDatabase();

  stmts = {
    insertUrl: db.prepare(`
      INSERT INTO urls (code, original_url, is_custom, expires_at)
      VALUES (@code, @originalUrl, @isCustom, @expiresAt)
    `),
    findByCode: db.prepare('SELECT * FROM urls WHERE code = ?'),
    findById: db.prepare('SELECT * FROM urls WHERE id = ?'),
    incrementClicks: db.prepare(`
      UPDATE urls SET clicks = clicks + 1, last_clicked_at = datetime('now') WHERE id = ?
    `),
    insertClickEvent: db.prepare(`
      INSERT INTO click_events (url_id, ip_hash, user_agent, referer)
      VALUES (@urlId, @ipHash, @userAgent, @referer)
    `),
    listUrls: db.prepare(`
      SELECT * FROM urls ORDER BY created_at DESC LIMIT @limit OFFSET @offset
    `),
    countUrls: db.prepare('SELECT COUNT(*) as total FROM urls'),
    deleteUrl: db.prepare('DELETE FROM urls WHERE id = ?'),
    clicksByDay: db.prepare(`
      SELECT date(clicked_at) as day, COUNT(*) as count
      FROM click_events
      WHERE url_id = ? AND clicked_at >= datetime('now', ?)
      GROUP BY date(clicked_at)
      ORDER BY day ASC
    `),
    recentClicks: db.prepare(`
      SELECT clicked_at, ip_hash, user_agent, referer
      FROM click_events
      WHERE url_id = ?
      ORDER BY clicked_at DESC
      LIMIT 50
    `),
  };

  return stmts;
}

/**
 * Create a new shortened URL.
 * @param {CreateUrlParams} params
 * @returns {{ id: number, code: string, shortUrl: string, originalUrl: string, expiresAt: string|null }}
 */
function createUrl({ url, customSlug, expiresInMinutes }) {
  const db = getDatabase();
  const s = getStatements();

  let code;
  let isCustom = 0;

  if (customSlug) {
    const validation = validateCustomSlug(customSlug);
    if (!validation.valid) {
      const err = new Error(validation.reason);
      err.statusCode = 400;
      throw err;
    }

    // Check if slug is already taken
    if (s.findByCode.get(customSlug)) {
      const err = new Error(`Slug "${customSlug}" is already in use`);
      err.statusCode = 409;
      throw err;
    }

    code = customSlug;
    isCustom = 1;
  } else {
    code = generateUniqueCode(db);
  }

  let expiresAt = null;
  if (expiresInMinutes && expiresInMinutes > 0) {
    // Calculate expiration time as ISO string
    const expiresDate = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    expiresAt = expiresDate.toISOString().replace('T', ' ').slice(0, 19);
  }

  const result = s.insertUrl.run({
    code,
    originalUrl: url,
    isCustom,
    expiresAt,
  });

  return {
    id: result.lastInsertRowid,
    code,
    shortUrl: `${config.baseUrl}/${code}`,
    originalUrl: url,
    expiresAt,
  };
}

/**
 * Resolve a short code to its original URL.
 * Returns null if not found or expired.
 * @param {string} code
 * @returns {UrlRecord|null}
 */
function resolveCode(code) {
  const s = getStatements();
  const record = s.findByCode.get(code);

  if (!record) return null;

  // Check expiration
  if (record.expires_at) {
    const expiresAt = new Date(record.expires_at + 'Z');
    if (expiresAt <= new Date()) {
      return { ...record, expired: true };
    }
  }

  return record;
}

/**
 * Record a click event and increment the counter.
 * Runs in a transaction for atomicity.
 * @param {number} urlId
 * @param {{ ip: string, userAgent: string, referer: string }} meta
 */
function trackClick(urlId, { ip, userAgent, referer }) {
  const db = getDatabase();
  const s = getStatements();

  // Hash IP for privacy
  const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);

  const trackTransaction = db.transaction(() => {
    s.incrementClicks.run(urlId);
    s.insertClickEvent.run({
      urlId,
      ipHash,
      userAgent: userAgent || null,
      referer: referer || null,
    });
  });

  trackTransaction();
}

/**
 * List URLs with pagination.
 * @param {{ page: number, limit: number }} options
 * @returns {{ data: UrlRecord[], pagination: { page: number, limit: number, total: number, totalPages: number } }}
 */
function listUrls({ page = 1, limit = config.pagination.defaultLimit } = {}) {
  const s = getStatements();
  const offset = (page - 1) * limit;

  const data = s.listUrls.all({ limit, offset });
  const { total } = s.countUrls.get();

  // Enrich with shortUrl
  const enriched = data.map(row => ({
    ...row,
    shortUrl: `${config.baseUrl}/${row.code}`,
  }));

  return {
    data: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get URL details by ID.
 * @param {number} id
 * @returns {UrlRecord|null}
 */
function getUrlById(id) {
  const s = getStatements();
  const record = s.findById.get(id);
  if (!record) return null;
  return { ...record, shortUrl: `${config.baseUrl}/${record.code}` };
}

/**
 * Get click statistics for a URL.
 * @param {number} id
 * @param {{ days: number }} options
 * @returns {{ totalClicks: number, clicksByDay: Array<{day: string, count: number}>, recentClicks: Array }}
 */
function getUrlStats(id, { days = 7 } = {}) {
  const s = getStatements();
  const url = s.findById.get(id);
  if (!url) return null;

  const clicksByDay = s.clicksByDay.all(id, `-${days} days`);
  const recentClicks = s.recentClicks.all(id);

  return {
    url: { ...url, shortUrl: `${config.baseUrl}/${url.code}` },
    totalClicks: url.clicks,
    clicksByDay,
    recentClicks,
  };
}

/**
 * Delete a URL and its associated click events (cascade).
 * @param {number} id
 * @returns {boolean} true if deleted
 */
function deleteUrl(id) {
  const s = getStatements();
  const result = s.deleteUrl.run(id);
  return result.changes > 0;
}

module.exports = {
  createUrl,
  resolveCode,
  trackClick,
  listUrls,
  getUrlById,
  getUrlStats,
  deleteUrl,
};
