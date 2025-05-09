import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('./my.db'); // define first
const { Database } = sqlite3;
const runAsync = promisify(db.run.bind(db));

export { db }; // ✅ now db exists

db.serialize(() => {
  db.each("PRAGMA table_info(nfts);", (err, row) => {
    if (err) {
      console.error("Error checking table info:", err);
    } else {
      console.log(row); // This will print each column in the 'nfts' table
    }
  });
});

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
    owner_wallet_address TEXT NOT NULL,
    collection_name TEXT,
    collection_id TEXT,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_token_id_nfts ON nfts(token_id);
  CREATE INDEX IF NOT EXISTS idx_collection_id_nfts ON nfts(collection_id);
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
    properties TEXT,
    collection_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_token_id_minted_nfts ON minted_nfts(token_id);
  CREATE INDEX IF NOT EXISTS idx_collection_id_minted_nfts ON minted_nfts(collection_id);
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
  CREATE INDEX IF NOT EXISTS idx_collection_name ON collections(name);
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
  CREATE INDEX IF NOT EXISTS idx_nft_id_bids ON bids(nft_id);
  CREATE INDEX IF NOT EXISTS idx_user_wallet_bids ON bids(user_wallet);
  CREATE INDEX IF NOT EXISTS idx_user_wallet_nft_id_bids ON bids(user_wallet, nft_id);
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
  CREATE INDEX IF NOT EXISTS idx_nft_id_transactions ON transaction_history(nft_id);
  CREATE INDEX IF NOT EXISTS idx_from_wallet_transactions ON transaction_history(from_wallet);
  CREATE INDEX IF NOT EXISTS idx_to_wallet_transactions ON transaction_history(to_wallet);
`;

const createTransactionLogsTable = `
  CREATE TABLE IF NOT EXISTS transaction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    action_details TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_action_type_logs ON transaction_logs(action_type);
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

// --- Helper to run a query ---
const runQuery = (query) => {
  return new Promise((resolve, reject) => {
    db.run(query, (err) => (err ? reject(err) : resolve()));
  });
};

// --- Initialize tables ---
// dbsetup.js

// Define your createTables function
const createTables = async () => {
  try {
    await runQuery(createUsersTable);
    await runQuery(createNFTsTable);
    await runQuery(createSalesTable);
    await runQuery(createMintingTransactionsTable);
    await runQuery(createPaymentsTable);
    await runQuery(createLikesTable);
    await runQuery(createMintedNFTsTable);
    await runQuery(createCollectionsTable);
    await runQuery(createUserProfilesTable);
    await runQuery(createBidsTable);
    await runQuery(createTransactionHistoryTable);
    await runQuery(createTransactionLogsTable);
    await runQuery(createNFTMetadataTable);
    console.log("Database tables and indexes initialized.");
  } catch (err) {
    console.error("Error initializing tables:", err);
  }
};

// Export the createTables function
export { createTables };


// --- Helper to add the collection_name column if not exists ---
const addCollectionNameToNFTsTable = async () => {
  const query = `PRAGMA table_info(nfts)`;
  db.all(query, (err, columns) => {
    if (err) {
      console.error('Error fetching table schema:', err);
      return;
    }
    
    // Add collection_name column if it doesn't exist in the 'nfts' table
const addCollectionNameToNFTsTable = async () => {
  const query = `PRAGMA table_info(nfts)`;
  db.all(query, (err, columns) => {
    if (err) {
      console.error('Error fetching table schema:', err);
      return;
    }

    const collectionNameExists = columns.some((col) => col.name === 'collection_name');
    if (!collectionNameExists) {
      const alterTableQuery = `ALTER TABLE nfts ADD COLUMN collection_name TEXT`;
      db.run(alterTableQuery, (err) => {
        if (err) {
          console.error('Error adding collection_name column:', err);
        } else {
          console.log('Collection name column added to NFTs table.');
        }
      });
    }
  });
};

    const collectionNameExists = columns.some((col) => col.name === 'collection_name');
    if (!collectionNameExists) {
      const alterTableQuery = `ALTER TABLE nfts ADD COLUMN collection_name TEXT`;
      db.run(alterTableQuery, (err) => {
        if (err) {
          console.error('Error adding collection_name column:', err);
        } else {
          console.log('Collection name column added to NFTs table.');
        }
      });
    }
  });
};




// Export other functions if needed


export const insertMintedNFT = async (nftData) => {
  const { token_id, metadata_uri, owner_wallet_address, collection_name } = nftData;
  const query = `INSERT INTO nfts (token_id, metadata_uri, owner_wallet_address, collection_name)
                 VALUES (?, ?, ?, ?)`;
  return new Promise((resolve, reject) => {
    db.run(query, [token_id, metadata_uri, owner_wallet_address, collection_name], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID); // Return the last inserted ID
      }
    });
  });
};

// Call the async function to initialize tables and add the missing column
createTables().then(() => {
  addCollectionNameToNFTsTable();
});

