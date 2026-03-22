const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[store] Failed to load data:', e.message);
  }
  return {};
}

function save(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('[store] Failed to save data:', e.message);
  }
}

// In-memory DB: { [shortCode]: { originalUrl, shortCode, clicks, createdAt, expiresAt | null } }
let db = load();

const store = {
  // 저장
  set(shortCode, entry) {
    db[shortCode] = entry;
    save(db);
  },

  // 조회
  get(shortCode) {
    return db[shortCode] || null;
  },

  // 존재 여부
  has(shortCode) {
    return Object.prototype.hasOwnProperty.call(db, shortCode);
  },

  // 클릭 증가
  incrementClicks(shortCode) {
    if (db[shortCode]) {
      db[shortCode].clicks += 1;
      save(db);
    }
  },

  // 전체 목록 (만료되지 않은 것 포함 모두 반환, 만료 여부는 별도 필드로 표시)
  getAll() {
    const now = Date.now();
    return Object.values(db).map((entry) => ({
      ...entry,
      expired: entry.expiresAt ? now > entry.expiresAt : false,
    }));
  },

  // 만료 항목 삭제
  purgeExpired() {
    const now = Date.now();
    let purged = 0;
    for (const code of Object.keys(db)) {
      if (db[code].expiresAt && now > db[code].expiresAt) {
        delete db[code];
        purged++;
      }
    }
    if (purged > 0) save(db);
    return purged;
  },
};

module.exports = store;
