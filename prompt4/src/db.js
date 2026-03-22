const store = new Map();

function createUrl(code, originalUrl, expiresAt) {
  const entry = {
    code,
    originalUrl,
    clicks: 0,
    createdAt: Date.now(),
    expiresAt: expiresAt || null,
    clickHistory: [],
  };
  store.set(code, entry);
  return entry;
}

function getUrl(code) {
  return store.get(code) || null;
}

function getAllUrls() {
  return Array.from(store.values());
}

function recordClick(code, userAgent, ip) {
  const entry = store.get(code);
  if (!entry) return null;
  entry.clicks += 1;
  entry.clickHistory.push({
    timestamp: Date.now(),
    userAgent: userAgent || '',
    ip: ip || '',
  });
  return entry;
}

function isExpired(entry) {
  if (entry.expiresAt === null) return false;
  return Date.now() > entry.expiresAt;
}

function deleteExpired() {
  for (const [code, entry] of store) {
    if (isExpired(entry)) {
      store.delete(code);
    }
  }
}

module.exports = {
  createUrl,
  getUrl,
  getAllUrls,
  recordClick,
  isExpired,
  deleteExpired,
};
