// db.js
import { Database } from 'sqlite3';
import path from 'path';

const db = new Database(path.resolve('payloads.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS used_payloads (
      uuid TEXT PRIMARY KEY,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

export function markPayloadUsed(uuid) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT OR IGNORE INTO used_payloads (uuid) VALUES (?)`, uuid, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function isPayloadUsed(uuid) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT 1 FROM used_payloads WHERE uuid = ?`, uuid, (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });
}
