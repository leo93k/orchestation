const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Override DB path before any imports
const testDbPath = path.join(__dirname, '..', 'data', 'test-api.db');
process.env.DB_PATH = testDbPath;

const { createApp } = require('../app');
const { getDatabase, closeDatabase } = require('../db/database');

// Simple HTTP test helper (no supertest dependency needed)
const http = require('http');

let server;
let baseUrl;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: new URL(baseUrl).port,
      path: urlPath,
      method,
      headers: {},
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(responseBody); } catch { parsed = responseBody; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('API Integration Tests', () => {
  before(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    getDatabase();
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    baseUrl = `http://localhost:${addr.port}`;
  });

  after(() => {
    server.close();
    closeDatabase();
    for (const suffix of ['', '-wal', '-shm']) {
      const f = testDbPath + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  describe('POST /api/urls', () => {
    it('should create a shortened URL', async () => {
      const res = await request('POST', '/api/urls', {
        url: 'https://example.com/api-test',
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.code);
      assert.equal(res.body.originalUrl, 'https://example.com/api-test');
    });

    it('should reject invalid URL', async () => {
      const res = await request('POST', '/api/urls', {
        url: 'not-a-url',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('should create URL with custom slug', async () => {
      const res = await request('POST', '/api/urls', {
        url: 'https://example.com/custom-api',
        customSlug: 'api-custom',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.code, 'api-custom');
    });

    it('should reject duplicate custom slug', async () => {
      const res = await request('POST', '/api/urls', {
        url: 'https://example.com/dup',
        customSlug: 'api-custom',
      });

      assert.equal(res.status, 409);
    });
  });

  describe('GET /api/urls', () => {
    it('should list URLs with pagination', async () => {
      const res = await request('GET', '/api/urls?page=1&limit=10');

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.pagination);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request('GET', '/health');

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.ok(typeof res.body.uptime === 'number');
    });
  });

  describe('DELETE /api/urls/:id', () => {
    it('should delete a URL', async () => {
      // Create first
      const createRes = await request('POST', '/api/urls', {
        url: 'https://example.com/to-delete',
      });
      const id = createRes.body.id;

      const deleteRes = await request('DELETE', `/api/urls/${id}`);
      assert.equal(deleteRes.status, 204);
    });

    it('should return 404 for non-existent URL', async () => {
      const res = await request('DELETE', '/api/urls/999999');
      assert.equal(res.status, 404);
    });
  });
});
