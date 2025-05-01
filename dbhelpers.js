const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

/**
 * Helper to get total number of NFTs minted
 */
async function getTotalNFTs() {
  const result = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM nfts', (err, row) => {
      if (err) reject(err);
      resolve(row.count);
    });
  });
  return result;
}

/**
 * Helper to get most liked NFTs
 */
async function getMostLikedNFTs() {
  const result = await new Promise((resolve, reject) => {
    db.all('SELECT nft_id, COUNT(*) AS likes_count FROM likes GROUP BY nft_id ORDER BY likes_count DESC LIMIT 10', (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
  return result;
}

/**
 * Helper to get the total number of users
 */
async function getTotalUsers() {
  const result = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
      if (err) reject(err);
      resolve(row.count);
    });
  });
  return result;
}

/**
 * Helper to get total mints by all users
 */
async function getTotalMints() {
  const result = await new Promise((resolve, reject) => {
    db.get('SELECT SUM(total_mints) AS total FROM users', (err, row) => {
      if (err) reject(err);
      resolve(row.total);
    });
  });
  return result;
}

module.exports = { getTotalNFTs, getMostLikedNFTs, getTotalUsers, getTotalMints };
