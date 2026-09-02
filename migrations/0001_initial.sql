CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  allergens TEXT NOT NULL DEFAULT '[]',
  service_note TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'sage',
  category TEXT NOT NULL DEFAULT 'crudo',
  weight INTEGER NOT NULL DEFAULT 0,
  components TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  invite_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  telegram_id TEXT,
  username TEXT,
  photo_url TEXT,
  last_seen_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_staff_id ON attempts(staff_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category_active ON dishes(category, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_telegram_id ON staff(telegram_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_id ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_telegram_created ON auth_attempts(telegram_id, created_at);
