const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Override DB path to use a temporary test database
const testDbPath = path.join(__dirname, '..', 'data', 'test.db');
process.env.DB_PATH = testDbPath;

const { getDatabase, closeDatabase } = require('../db/database');
const urlService = require('../services/url.service');

describe('URL Service', () => {
  before(() => {
    // Ensure clean test DB
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    getDatabase();
  });

  after(() => {
    closeDatabase();
    // Cleanup test DB files
    for (const suffix of ['', '-wal', '-shm']) {
      const f = testDbPath + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  describe('createUrl', () => {
    it('should create a shortened URL with auto-generated code', () => {
      const result = urlService.createUrl({ url: 'https://example.com/test' });

      assert.ok(result.id);
      assert.ok(result.code);
      assert.equal(result.code.length, 7);
      assert.equal(result.originalUrl, 'https://example.com/test');
      assert.ok(result.shortUrl.includes(result.code));
      assert.equal(result.expiresAt, null);
    });

    it('should create a URL with custom slug', () => {
      const result = urlService.createUrl({
        url: 'https://example.com/custom',
        customSlug: 'my-test-slug',
      });

      assert.equal(result.code, 'my-test-slug');
    });

    it('should reject duplicate custom slug', () => {
      assert.throws(() => {
        urlService.createUrl({
          url: 'https://example.com/another',
          customSlug: 'my-test-slug',
        });
      }, /already in use/);
    });

    it('should reject reserved slugs', () => {
      assert.throws(() => {
        urlService.createUrl({
          url: 'https://example.com',
          customSlug: 'api',
        });
      }, /reserved/);
    });

    it('should set expiration when expiresInMinutes is provided', () => {
      const result = urlService.createUrl({
        url: 'https://example.com/expiring',
        expiresInMinutes: 60,
      });

      assert.ok(result.expiresAt);
    });
  });

  describe('resolveCode', () => {
    it('should resolve a valid code to its URL record', () => {
      const created = urlService.createUrl({ url: 'https://example.com/resolve' });
      const resolved = urlService.resolveCode(created.code);

      assert.ok(resolved);
      assert.equal(resolved.original_url, 'https://example.com/resolve');
    });

    it('should return null for non-existent code', () => {
      const result = urlService.resolveCode('nonexist');
      assert.equal(result, null);
    });

    it('should mark expired URLs', () => {
      // Create a URL that expires in -1 minutes (already expired)
      const db = getDatabase();
      const code = 'expired1';
      db.prepare(`
        INSERT INTO urls (code, original_url, expires_at)
        VALUES (?, ?, datetime('now', '-1 minute'))
      `).run(code, 'https://example.com/expired');

      const result = urlService.resolveCode(code);
      assert.ok(result.expired);
    });
  });

  describe('trackClick', () => {
    it('should increment click counter and create event', () => {
      const created = urlService.createUrl({ url: 'https://example.com/track' });
      const record = urlService.resolveCode(created.code);

      urlService.trackClick(record.id, {
        ip: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
        referer: 'https://google.com',
      });

      const updated = urlService.getUrlById(record.id);
      assert.equal(updated.clicks, 1);
    });
  });

  describe('listUrls', () => {
    it('should return paginated list', () => {
      const result = urlService.listUrls({ page: 1, limit: 5 });

      assert.ok(Array.isArray(result.data));
      assert.ok(result.pagination);
      assert.ok(result.pagination.total > 0);
    });
  });

  describe('deleteUrl', () => {
    it('should delete an existing URL', () => {
      const created = urlService.createUrl({ url: 'https://example.com/delete-me' });
      const deleted = urlService.deleteUrl(created.id);
      assert.equal(deleted, true);

      const found = urlService.getUrlById(created.id);
      assert.equal(found, null);
    });

    it('should return false for non-existent URL', () => {
      const deleted = urlService.deleteUrl(999999);
      assert.equal(deleted, false);
    });
  });
});
