const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;

/**
 * Initialize SQLite database connection and run migrations.
 * Returns the singleton db instance.
 */
function getDatabase() {
  if (db) return db;

  // Ensure data directory exists
  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.db.path);

  // Performance pragmas for production use
  db.pragma('journal_mode = WAL');       // Write-Ahead Logging: concurrent reads during writes
  db.pragma('synchronous = NORMAL');     // Balance between safety and speed
  db.pragma('foreign_keys = ON');        // Enforce FK constraints
  db.pragma('busy_timeout = 5000');      // Wait up to 5s on lock contention

  runMigrations(db);

  return db;
}

/**
 * Run all SQL migration files in order.
 * Uses a simple version tracking table.
 */
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
  }
}

/**
 * Close database connection gracefully.
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get database file size in bytes for health checks.
 */
function getDatabaseSize() {
  try {
    const stats = fs.statSync(config.db.path);
    return stats.size;
  } catch {
    return 0;
  }
}

module.exports = { getDatabase, closeDatabase, getDatabaseSize };
