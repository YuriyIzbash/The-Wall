PRAGMA defer_foreign_keys = ON;

-- The old schema has a circular relationship:
--   payments.message_id     -> wall_messages.id
--   wall_messages.payment_id -> payments.id
--
-- Payments are no longer required for publishing.
-- Preserve the existing payment history, but remove the obsolete
-- foreign-key relationships.

CREATE TABLE payments_new (
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
  last_checked_at TEXT
);

INSERT INTO payments_new (
  id,
  message_id,
  expected_amount,
  token,
  network,
  recipient_address,
  transaction_hash,
  sender_address,
  status,
  created_at,
  expires_at,
  confirmed_at,
  verification_attempts,
  last_checked_at
)
SELECT
  id,
  message_id,
  expected_amount,
  token,
  network,
  recipient_address,
  transaction_hash,
  sender_address,
  status,
  created_at,
  expires_at,
  confirmed_at,
  verification_attempts,
  last_checked_at
FROM payments;

CREATE TABLE wall_messages_new (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  author TEXT,
  is_anonymous INTEGER NOT NULL CHECK (is_anonymous IN (0, 1)),
  font TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  overwritten_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'overwritten')),
  payment_id TEXT UNIQUE,
  contribution_id TEXT UNIQUE
);

INSERT INTO wall_messages_new (
  id,
  message,
  author,
  is_anonymous,
  font,
  color,
  created_at,
  overwritten_at,
  status,
  payment_id
)
SELECT
  id,
  message,
  author,
  is_anonymous,
  font,
  color,
  created_at,
  overwritten_at,
  status,
  payment_id
FROM wall_messages;

DROP TABLE wall_messages;
DROP TABLE payments;

ALTER TABLE wall_messages_new RENAME TO wall_messages;
ALTER TABLE payments_new RENAME TO payments;

CREATE UNIQUE INDEX wall_messages_one_active
  ON wall_messages(status)
  WHERE status = 'active';

CREATE INDEX wall_messages_status_created_at_idx
  ON wall_messages(status, created_at DESC);

CREATE INDEX wall_messages_overwritten_at_idx
  ON wall_messages(overwritten_at DESC);

CREATE INDEX wall_messages_contribution_id_idx
  ON wall_messages(contribution_id);

CREATE INDEX payments_status_expires_at_idx
  ON payments(status, expires_at);

CREATE INDEX payments_message_id_idx
  ON payments(message_id);

CREATE TABLE contribution_requests (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  requested_amount TEXT NOT NULL DEFAULT '1',
  token TEXT NOT NULL CHECK (token = 'USDT'),
  network TEXT NOT NULL CHECK (
    network IN ('bsc', 'ethereum', 'tron', 'polygon', 'solana', 'ton')
  ),
  recipient_address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (message_id)
    REFERENCES wall_messages(id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX contribution_requests_message_id_idx
  ON contribution_requests(message_id);