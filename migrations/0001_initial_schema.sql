PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  expected_amount TEXT NOT NULL,
  token TEXT NOT NULL CHECK (token = 'USDT'),
  network TEXT NOT NULL CHECK (network = 'TRON'),
  recipient_address TEXT NOT NULL,
  transaction_hash TEXT UNIQUE,
  sender_address TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'invalid', 'expired')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  confirmed_at TEXT,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  FOREIGN KEY (message_id) REFERENCES wall_messages(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS wall_messages (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  author TEXT,
  is_anonymous INTEGER NOT NULL CHECK (is_anonymous IN (0, 1)),
  font TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  overwritten_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'overwritten')),
  payment_id TEXT NOT NULL UNIQUE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) DEFERRABLE INITIALLY DEFERRED
);

-- SQLite/D1 enforces the one-active-message invariant directly.
CREATE UNIQUE INDEX IF NOT EXISTS wall_messages_one_active
  ON wall_messages(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS wall_messages_status_created_at_idx
  ON wall_messages(status, created_at DESC);

CREATE INDEX IF NOT EXISTS wall_messages_overwritten_at_idx
  ON wall_messages(overwritten_at DESC);

CREATE INDEX IF NOT EXISTS payments_status_expires_at_idx
  ON payments(status, expires_at);

CREATE INDEX IF NOT EXISTS payments_message_id_idx
  ON payments(message_id);
