'use strict';

const store = new Map();

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[idx];
  }
  return code;
}

function generateUniqueCode() {
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 1000) {
      throw new Error('Failed to generate unique code after 1000 attempts');
    }
  } while (store.has(code));
  return code;
}

function createShortUrl(originalUrl, customCode, expiresInSeconds) {
  let code;
  if (customCode) {
    if (store.has(customCode)) {
      const err = new Error('Custom code already exists');
      err.code = 'DUPLICATE_CODE';
      throw err;
    }
    code = customCode;
  } else {
    code = generateUniqueCode();
  }

  const now = new Date();
  const expiresAt = expiresInSeconds ? new Date(now.getTime() + expiresInSeconds * 1000) : null;

  store.set(code, {
    code,
    originalUrl,
    clicks: 0,
    createdAt: now.toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  });

  return code;
}

function getUrl(code) {
  const entry = store.get(code);
  if (!entry) return null;
  return entry;
}

function incrementClick(code) {
  const entry = store.get(code);
  if (!entry) return false;
  entry.clicks += 1;
  store.set(code, entry);
  return true;
}

function getAllUrls() {
  return Array.from(store.values());
}

function deleteUrl(code) {
  if (!store.has(code)) return false;
  store.delete(code);
  return true;
}

function isExpired(entry) {
  if (!entry.expiresAt) return false;
  return new Date() > new Date(entry.expiresAt);
}

module.exports = {
  createShortUrl,
  getUrl,
  incrementClick,
  getAllUrls,
  deleteUrl,
  isExpired,
};
