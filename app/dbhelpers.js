import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose();
const db = new sqlite3.Database('./database.db');

export async function getTotalNFTs() {
  return await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM nfts', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

export async function getMostLikedNFTs() {
  return await new Promise((resolve, reject) => {
    db.all('SELECT nft_id, COUNT(*) AS likes_count FROM likes GROUP BY nft_id ORDER BY likes_count DESC LIMIT 10', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function getTotalUsers() {
  return await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

export async function getTotalMints() {
  return await new Promise((resolve, reject) => {
    db.get('SELECT SUM(total_mints) AS total FROM users', (err, row) => {
      if (err) reject(err);
      else resolve(row.total);
    });
  });
}
