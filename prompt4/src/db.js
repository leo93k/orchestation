const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeData(entries) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function findByCode(code) {
  const entries = readData();
  return entries.find((e) => e.shortCode === code) || null;
}

function findAll() {
  return readData();
}

function create({ shortCode, originalUrl, expiresAt }) {
  const entries = readData();
  const entry = {
    shortCode,
    originalUrl,
    clicks: 0,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
  };
  entries.push(entry);
  writeData(entries);
  return entry;
}

function incrementClick(code) {
  const entries = readData();
  const entry = entries.find((e) => e.shortCode === code);
  if (entry) {
    entry.clicks += 1;
    writeData(entries);
  }
}

function isCodeTaken(code) {
  const entries = readData();
  return entries.some((e) => e.shortCode === code);
}

function deleteExpired() {
  const entries = readData();
  const now = new Date();
  const active = entries.filter((e) => {
    if (!e.expiresAt) return true;
    return new Date(e.expiresAt) > now;
  });
  writeData(active);
}

module.exports = {
  findByCode,
  findAll,
  create,
  incrementClick,
  isCodeTaken,
  deleteExpired,
};
