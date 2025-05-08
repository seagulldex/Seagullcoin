import sqlite3 from 'sqlite3';

// Initialize the database
const db = new sqlite3.Database('./database.db');

// Enable foreign key support in SQLite
db.exec('PRAGMA foreign_keys = ON');

// --- SQL Table Definitions ---
const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL UNIQUE,
    total_mints INTEGER DEFAULT 0,
    seagullcoin_balance DECIMAL(20, 8) DEFAULT 0,
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

const createSalesTable = `
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nft_id INTEGER NOT NULL,
    seller_wallet TEXT NOT NULL,
    buyer_wallet TEXT NOT NULL,
    sale_price DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nft_id) REFERENCES nfts(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_wallet) REFERENCES users(wallet_address) ON DELETE CASCADE,
    FOREIGN KEY (buyer_wallet) REFERENCES users(wallet_address) ON DELETE CASCADE
  );
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
    properties TEXT, -- JSON string
    collection_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_token_id_minted_nfts ON minted_nfts(token_id);
  CREATE INDEX IF NOT EXISTS idx_collection_id_minted_nfts ON minted_nfts(collection_id);
`;

// --- Helper to run a query ---
const runQuery = (query) => {
  return new Promise((resolve, reject) => {
    db.run(query, (err) => (err ? reject(err) : resolve()));
  });
};

// --- Initialize tables ---
const createTables = async () => {
  try {
    await runQuery(createUsersTable);
    await runQuery(createNFTsTable);
    await runQuery(createSalesTable);
    await runQuery(createMintingTransactionsTable);
    await runQuery(createPaymentsTable);
    await runQuery(createLikesTable);
    await runQuery(createMintedNFTsTable);
    console.log("Database tables and indexes initialized.");
  } catch (err) {
    console.error("Error initializing tables:", err);
  }
};

// Run the function to create the tables
createTables();

// --- Insert minted NFT ---
const insertMintedNFT = (nft) => {
  const {
    wallet,
    token_id,
    uri,
    name,
    description,
    properties,
    collection_id
  } = nft;

  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO minted_nfts (wallet, token_id, uri, name, description, properties, collection_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        wallet,
        token_id,
        uri,
        name,
        description,
        JSON.stringify(properties || {}),
        collection_id || null
      ],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
};

// Update SeagullCoin balance
const updateUserBalance = (walletAddress, amount) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users
      SET seagullcoin_balance = seagullcoin_balance + ?
      WHERE wallet_address = ?
    `;
    db.run(query, [amount, walletAddress], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes); // Returns the number of rows affected
      }
    });
  });
};

// Check user SeagullCoin balance
const checkUserBalance = (walletAddress) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT seagullcoin_balance
      FROM users
      WHERE wallet_address = ?
    `;
    db.get(query, [walletAddress], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.seagullcoin_balance : 0); // Return balance or 0 if not found
      }
    });
  });
};

// Mint NFT logic
const mintNFT = async (walletAddress, nftDetails) => {
  const balance = await checkUserBalance(walletAddress);

  if (balance < 0.5) {
    throw new Error("Insufficient SeagullCoin balance to mint NFT.");
  }

  // Proceed with minting logic
  const mintedNFTId = await insertMintedNFT(nftDetails);

  // After minting, deduct the 0.5 SeagullCoin for the minting cost
  await updateUserBalance(walletAddress, -0.5);  // Deduct 0.5 SGLCN
};

export { db, createTables, insertMintedNFT };
export default db;
