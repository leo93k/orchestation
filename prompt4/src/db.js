const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
    return [];
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getAllUrls() {
  return readData();
}

function findByCode(code) {
  const data = readData();
  return data.find(entry => entry.code === code) || null;
}

function findByOriginalUrl(url) {
  const data = readData();
  return data.find(entry => entry.originalUrl === url) || null;
}

function save(entry) {
  const data = readData();
  data.push(entry);
  writeData(data);
  return entry;
}

function incrementClicks(code) {
  const data = readData();
  const index = data.findIndex(entry => entry.code === code);
  if (index !== -1) {
    data[index].clicks = (data[index].clicks || 0) + 1;
    writeData(data);
    return data[index];
  }
  return null;
}

function deleteExpired() {
  const data = readData();
  const now = new Date().toISOString();
  const active = data.filter(entry => {
    if (!entry.expiresAt) return true;
    return entry.expiresAt > now;
  });
  if (active.length !== data.length) {
    writeData(active);
  }
  return data.length - active.length;
}

module.exports = {
  getAllUrls,
  findByCode,
  findByOriginalUrl,
  save,
  incrementClicks,
  deleteExpired,
};
