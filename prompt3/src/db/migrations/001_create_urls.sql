-- URL shortener schema v1
-- urls: core table storing shortened URL mappings
CREATE TABLE IF NOT EXISTS urls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,
  original_url  TEXT    NOT NULL,
  is_custom     INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT,
  last_clicked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_code ON urls(code);
CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls(created_at);

-- click_events: per-click detail for time-series analytics
CREATE TABLE IF NOT EXISTS click_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id      INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  clicked_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  ip_hash     TEXT,
  user_agent  TEXT,
  referer     TEXT
);

CREATE INDEX IF NOT EXISTS idx_click_events_url_id ON click_events(url_id);
CREATE INDEX IF NOT EXISTS idx_click_events_clicked_at ON click_events(clicked_at);
