import sqlite3 from 'sqlite3'; // default import doesn't exist
const { Database } = sqlite3.verbose(); // enable verbose mode
const db = new Database('./my.db');


const runAsync = promisify(db.run.bind(db));
// dbsetup.js
export default createTables;

export { db }; // ✅ now db exists

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

const initDB = async () => {
  await createTables(); // Initialize all the tables
  console.log("Database initialized.");
};

initDB(); // Call the initialization function to set up the tables


createTables();

// --- Insert a minted NFT ---
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

// --- Get User Address ---
const getUserAddress = (walletAddress) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT wallet_address
      FROM users
      WHERE wallet_address = ?
    `;
    db.get(query, [walletAddress], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.wallet_address : null); // Returns null if not found
      }
    });
  });
};


// --- Update user balance ---
const updateUserBalance = (walletAddress, amount) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users
      SET seagullcoin_balance = seagullcoin_balance + ?
      WHERE wallet_address = ?
    `;
    db.run(query, [amount, walletAddress], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const ensureUserExists = async (walletAddress) => {
  const query = `
    INSERT OR IGNORE INTO users (wallet_address)
    VALUES (?)
  `;
  return new Promise((resolve, reject) => {
    db.run(query, [walletAddress], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

// --- Upsert User ---
const upsertUser = (walletAddress) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO users (wallet_address)
      VALUES (?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        wallet_address = excluded.wallet_address
    `;
    db.run(query, [walletAddress], function (err) {
      if (err) reject(err);
      else resolve(this.changes); // this.changes will be 1 if inserted or updated
    });
  });
};

// --- Insert a payment ---
const insertPayment = (payment) => {
  const {
    payload_uuid,
    wallet_address,
    amount,
    token_code,
    status
  } = payment;

  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO payments (payload_uuid, wallet_address, amount, token_code, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [payload_uuid, wallet_address, amount, token_code, status || 'confirmed'],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID); // this.lastID will return the ID of the newly inserted payment
        }
      }
    );
  });
};


const upsertUserProfile = async (walletAddress, profile) => {
  const { display_name, bio, avatar_uri } = profile;
  const query = `
    INSERT INTO user_profiles (user_wallet_address, display_name, bio, avatar_uri)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_wallet_address) DO UPDATE SET
      display_name = excluded.display_name,
      bio = excluded.bio,
      avatar_uri = excluded.avatar_uri,
      updated_at = CURRENT_TIMESTAMP
  `;
  return new Promise((resolve, reject) => {
    db.run(query, [walletAddress, display_name, bio, avatar_uri], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

// --- Get all NFTs ---
const getAllNFTs = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM nfts'; // Simple query to fetch all NFTs from the table
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows); // 'rows' will contain an array of NFT records
      }
    });
  });
};

// --- Get all collections ---
const getAllCollections = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM collections'; // Simple query to fetch all collections from the table
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows); // 'rows' will contain an array of collection records
      }
    });
  });
};


// --- Example usage ---
ensureUserExists('user_wallet_address');
updateUserBalance('user_wallet_address', 10);
insertMintedNFT({
  wallet: 'user_wallet_address',
  token_id: 'token_id_example',
  uri: 'https://example.com/uri',
  name: 'NFT Name',
  description: 'NFT Description',
  properties: { key: 'value' },
  collection_id: 'collection_id_example'
});

export {
  initDB,
  getUserAddress,
  upsertUser,
  insertMintedNFT, // ← THIS is what mint-endpoint.js needs
  insertPayment,
  getAllNFTs,
  getAllCollections
};
