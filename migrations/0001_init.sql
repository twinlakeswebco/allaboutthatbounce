CREATE TABLE units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, description TEXT NOT NULL, size TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('dry','wet')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  deposit_required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE unit_photos (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  r2_key TEXT NOT NULL, position INTEGER NOT NULL
);
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  free_radius_miles REAL NOT NULL,
  per_mile_rate_cents INTEGER NOT NULL,
  trip_multiplier INTEGER NOT NULL,
  max_delivery_miles REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by TEXT
);
INSERT INTO settings (id, free_radius_miles, per_mile_rate_cents, trip_multiplier, max_delivery_miles) VALUES (1, 15, 35, 4, NULL);
CREATE TABLE blocks (
  unit_id TEXT NOT NULL REFERENCES units(id),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), created_by TEXT,
  PRIMARY KEY (unit_id, date)
);
CREATE TABLE booking_requests (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  unit_id TEXT NOT NULL, unit_name TEXT NOT NULL, unit_price_cents INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined')),
  name TEXT, phone TEXT, email TEXT, event_type TEXT, delivery_address TEXT,
  distance_miles REAL NOT NULL, delivery_fee_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT, decided_by TEXT, anonymized_at TEXT
);
CREATE UNIQUE INDEX one_confirmed_per_unit_date ON booking_requests (unit_id, event_date) WHERE status = 'confirmed';
CREATE INDEX idx_requests_status ON booking_requests (status, created_at);
CREATE TABLE quote_cache (address_hash TEXT PRIMARY KEY, distance_miles REAL NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE contact_messages (id TEXT PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, to_email TEXT NOT NULL, reply_to TEXT,
  subject TEXT NOT NULL, html TEXT NOT NULL, text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), sent_at TEXT
);
CREATE TABLE rate_limits (bucket TEXT NOT NULL, window_start TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (bucket, window_start));