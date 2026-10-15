import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tickets (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  customer_email     TEXT NOT NULL,
  category           TEXT NOT NULL CHECK (category IN ('Technical','Billing','General')),
  priority           TEXT NOT NULL CHECK (priority IN ('Low','Medium','High')),
  ai_status          TEXT NOT NULL CHECK (ai_status IN ('classified','fallback')),
  ai_fallback_reason TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets (category);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
`;

/** Opens (and migrates) a SQLite database. Use ':memory:' in tests. */
export function openDatabase(filePath: string): Database.Database {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }
  const db = new Database(filePath);
  if (filePath !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
