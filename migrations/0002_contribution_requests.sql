PRAGMA foreign_keys = OFF;

-- Preserve all existing Wall and payment history while removing the mandatory
-- payment relationship from new messages. Contribution requests are voluntary.
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
  id, message, author, is_anonymous, font, color, created_at, overwritten_at, status, payment_id
)
SELECT id, message, author, is_anonymous, font, color, created_at, overwritten_at, status, payment_id
FROM wall_messages;

DROP TABLE wall_messages;
ALTER TABLE wall_messages_new RENAME TO wall_messages;

CREATE UNIQUE INDEX wall_messages_one_active
  ON wall_messages(status)
  WHERE status = 'active';

CREATE INDEX wall_messages_status_created_at_idx
  ON wall_messages(status, created_at DESC);

CREATE INDEX wall_messages_overwritten_at_idx
  ON wall_messages(overwritten_at DESC);

CREATE INDEX wall_messages_contribution_id_idx
  ON wall_messages(contribution_id);

CREATE TABLE contribution_requests (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  requested_amount TEXT NOT NULL DEFAULT '1',
  token TEXT NOT NULL CHECK (token = 'USDT'),
  network TEXT NOT NULL CHECK (network IN ('bsc', 'ethereum', 'tron', 'polygon', 'solana', 'ton')),
  recipient_address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES wall_messages(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX contribution_requests_message_id_idx
  ON contribution_requests(message_id);

PRAGMA foreign_keys = ON;
