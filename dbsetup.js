import sqlite3 from 'sqlite3';

// Initialize the database
const db = new sqlite3.Database('./database.db');

// SQL to create tables and indexes
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL UNIQUE,
    total_mints INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_wallet_address_users ON users(wallet_address);
`;

const createNFTsTable = `
  CREATE TABLE IF NOT EXISTS nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id TEXT UNIQUE NOT NULL,
    metadata_uri TEXT NOT NULL,
    owner_wallet_address TEXT NOT NULL,
    collection_name TEXT,
    collection_id TEXT,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_token_id_nfts ON nfts(token_id);
`;

const createMintingTransactionsTable = `
  CREATE TABLE IF NOT EXISTS minting_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nft_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nft_id) REFERENCES nfts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_wallet_address_minting_transactions ON minting_transactions(wallet_address);
`;

const createPaymentsTable = `
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload_uuid TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    token_code TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_wallet_address_payments ON payments(wallet_address);
`;

CREATE TABLE IF NOT EXISTS nfts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT,
  nft_token_id TEXT,
  ipfs_uri TEXT,
  collection_name TEXT,
  minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


const createLikesTable = `
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_wallet TEXT NOT NULL,
    nft_id INTEGER NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nft_id) REFERENCES nfts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_user_wallet_likes ON likes(user_wallet);
`;

const createMintedNFTsTable = `
  CREATE TABLE IF NOT EXISTS minted_nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT NOT NULL,
    token_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    properties TEXT,
    collection_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_token_id_minted_nfts ON minted_nfts(token_id);
`;

// Helper function to run a query and return a promise
const runQuery = (query) => {
  return new Promise((resolve, reject) => {
    db.run(query, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Function to initialize the database schema
const createTables = async () => {
  try {
    // Create tables and indexes sequentially
    await runQuery(createUsersTable);
    await runQuery(createNFTsTable);
    await runQuery(createMintingTransactionsTable);
    await runQuery(createPaymentsTable);
    await runQuery(createLikesTable);
    await runQuery(createMintedNFTsTable);
    console.log("Database tables and indexes initialized.");
  } catch (err) {
    console.error("Error initializing tables:", err);
  }
};

// Function to insert a minted NFT into the database
const insertMintedNFT = (nft) => {
  const { wallet, token_id, uri, name, description, properties, collection_id } = nft;

  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO minted_nfts (wallet, token_id, uri, name, description, properties, collection_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [wallet, token_id, uri, name, description, properties || null, collection_id || null],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID); // return inserted row ID
        }
      }
    );
  });
};

// Exporting the `db` instance and `createTables` function
export { db, createTables, insertMintedNFT };
export default db;
