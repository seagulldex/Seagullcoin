import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Open database
const db = new sqlite3.Database('./my.db');
const runAsync = promisify(db.run.bind(db));
const allAsync = promisify(db.all.bind(db));

// Enable foreign key support
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
`;

const createUsersIndex = `
  CREATE INDEX IF NOT EXISTS idx_wallet_address_users ON users(wallet_address);
`;

const createUserProfilesTable = `
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_wallet_address TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    avatar_uri TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_wallet_address) REFERENCES users(wallet_address) ON DELETE CASCADE
  );
`;

const createNFTsTable = `
  CREATE TABLE IF NOT EXISTS nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id TEXT UNIQUE NOT NULL,
    metadata_uri TEXT NOT NULL,
    owner_wallet_address TEXT,
    collection_name TEXT,
    collection_id TEXT,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
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
`;

const createLikesTable = `
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_wallet TEXT NOT NULL,
    nft_id INTEGER NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nft_id) REFERENCES nfts(id)
  );
`;

const createMintedNFTsTable = `
  CREATE TABLE IF NOT EXISTS minted_nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT NOT NULL,
    uri TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    properties TEXT,
    owner_wallet_address TEXT,
    collection_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createCollectionsTable = `
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    logo_uri TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const createBidsTable = `
  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nft_id INTEGER NOT NULL,
    user_wallet TEXT NOT NULL,
    bid_amount DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nft_id) REFERENCES nfts(id),
    FOREIGN KEY (user_wallet) REFERENCES users(wallet_address)
  );
`;

const createTransactionHistoryTable = `
  CREATE TABLE IF NOT EXISTS transaction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nft_id INTEGER NOT NULL,
    from_wallet TEXT NOT NULL,
    to_wallet TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(20, 8),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nft_id) REFERENCES nfts(id),
    FOREIGN KEY (from_wallet) REFERENCES users(wallet_address),
    FOREIGN KEY (to_wallet) REFERENCES users(wallet_address)
  );
`;

const createTransactionLogsTable = `
  CREATE TABLE IF NOT EXISTS transaction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    action_details TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const createNFTMetadataTable = `
  CREATE TABLE IF NOT EXISTS nft_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nft_id INTEGER NOT NULL,
    metadata_key TEXT NOT NULL,
    metadata_value TEXT NOT NULL,
    FOREIGN KEY (nft_id) REFERENCES nfts(id)
  );
`;

// --- Run SQL query helper ---
const runQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, (err) => (err ? reject(err) : resolve()));
  });

// --- Create all tables ---
const createTables = async () => {
  try {
    await runQuery(createUsersTable);
    await runQuery(createUsersIndex);
    await runQuery(createUserProfilesTable);
    await runQuery(createNFTsTable);
    await runQuery(createSalesTable);
    await runQuery(createMintingTransactionsTable);
    await runQuery(createPaymentsTable);
    await runQuery(createLikesTable);
    await runQuery(createMintedNFTsTable);
    await runQuery(createCollectionsTable);
    await runQuery(createBidsTable);
    await runQuery(createTransactionHistoryTable);
    await runQuery(createTransactionLogsTable);
    await runQuery(createNFTMetadataTable);
    console.log('All tables initialized successfully.');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
};

// --- Add column if not exists helpers ---
const columnExists = async (table, column) => {
  const info = await allAsync(`PRAGMA table_info(${table})`);
  return info.some(col => col.name === column);
};

const addColumnIfNotExists = async (table, column, type) => {
  if (!(await columnExists(table, column))) {
    await runQuery(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`Added column ${column} to ${table}.`);
  }
};

// --- NFT Insert helper ---
const insertMintedNFT = async ({ token_id, metadata_uri, owner_wallet_address, collection_name }) => {
  const query = `INSERT INTO nfts (token_id, metadata_uri, owner_wallet_address, collection_name) VALUES (?, ?, ?, ?)`;
  await runQuery(query, [token_id, metadata_uri, owner_wallet_address, collection_name]);
};

const addOwnerWalletAddressToNFTsTable = async () => {
  await addColumnIfNotExists('nfts', 'owner_wallet_address', 'TEXT');
};

// Insert the minted NFT into the database
const mintNFT = async () => {
  try {
    await insertMintedNFT({
      token_id: "NFTOKENID123", // Replace with actual NFTOKENID
      metadata_uri: "https://example.com/metadata.json", // Replace with actual metadata URI
      owner_wallet_address: "rPLvYSKRUc3vqU3b4guho8Ya5ZC2X5ahYa", // Replace with actual owner wallet address
      collection_name: "MyNFTCollection" // Replace with actual collection name
    });
    console.log("NFT successfully minted and added to the database.");
  } catch (error) {
    console.error("Error inserting minted NFT into the database:", error);
  }
};

const mintNFTWithTransaction = async () => {
  const insertNFTQuery = `INSERT INTO nfts (token_id, metadata_uri, owner_wallet_address, collection_name) VALUES (?, ?, ?, ?)`;

  const dbTransaction = async (token_id, metadata_uri, owner_wallet_address, collection_name) => {
    try {
      await runQuery('BEGIN TRANSACTION');
      await runQuery(insertNFTQuery, [token_id, metadata_uri, owner_wallet_address, collection_name]);
      await runQuery('COMMIT');
      console.log("NFT successfully minted and added to the database.");
    } catch (error) {
      await runQuery('ROLLBACK');
      console.error("Error inserting minted NFT into the database:", error);
    }
  };

  await dbTransaction(
    "NFTOKENID123",
    "https://example.com/metadata.json",
    "rPLvYSKRUc3vqU3b4guho8Ya5ZC2X5ahYa",
    "MyNFTCollection"
  );
};


// Call the mintNFT function to insert the NFT
mintNFT();


export {
  createTables,
  addColumnIfNotExists,
  insertMintedNFT,
  addOwnerWalletAddressToNFTsTable,
  db,
  runAsync,
  allAsync
};
