import sqlite3Init from 'sqlite3';
const sqlite3 = sqlite3Init.verbose();
const db = new sqlite3.Database('./my.db');

import { promisify } from 'util';

const runAsync = promisify(db.run.bind(db));
const allAsync = promisify(db.all.bind(db));
const token_id = "NFTOKENID123";
const name = "Cool Seagull NFT";
const description = "This is a rare Seagull NFT";
const image_url = "https://example.com/seagull.png";
const collectionId = "seagull-collection-001";
const ownerWallet = "rPLvYSKRUc3vqU3b4guho8Ya5ZC2X5ahYa";
const mintingWallet = "rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U";
const metadataURL = "https://example.com/metadata.json";

// Enable foreign key support
db.exec('PRAGMA foreign_keys = ON');


(async () => {
  await addColumnIfNotExists('nfts', 'name', 'TEXT');
  await addColumnIfNotExists('nfts', 'description', 'TEXT');
  await addColumnIfNotExists("nfts", "updated_at", "TEXT");
  await addColumnIfNotExists("minted_nfts", "updated_at", "TEXT");
  await addColumnIfNotExists('nfts', 'properties', 'TEXT');
})();


(async () => {
  await createTables();
})();


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

const nfts = `
  CREATE TABLE IF NOT EXISTS nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    metadata_url TEXT,
    token_id TEXT UNIQUE,
    collection_name TEXT,
    collection_icon TEXT,
    owner_wallet_address TEXT NOT NULL,
    source TEXT CHECK(source IN ('minted', 'imported')) DEFAULT 'imported',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
`;

const createMintedNFTsTable = `
  CREATE TABLE IF NOT EXISTS minted_nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id TEXT UNIQUE,
    metadata_uri TEXT,
    owner_wallet_address TEXT NOT NULL,
    collection_name TEXT,
    name TEXT,
    description TEXT,
    properties TEXT,
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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



const createCollectionsTable = `
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    logo_uri TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
`;

const createTransactionLogsTable = `
  CREATE TABLE IF NOT EXISTS transaction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    action_details TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
`;

const createNFTMetadataTable = `
  CREATE TABLE IF NOT EXISTS nft_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nft_id INTEGER NOT NULL,
    metadata_key TEXT NOT NULL,
    metadata_value TEXT NOT NULL,
    FOREIGN KEY (nft_id) REFERENCES nfts(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_owner_wallet_address_nfts ON nfts(owner_wallet_address);
  CREATE INDEX idx_nfts_collection_name ON nfts(collection_name);
  CREATE INDEX idx_minted_nfts_nft_id ON minted_nfts(nft_id);
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
    await runQuery(nfts);
    await runQuery(createSalesTable);
    await runQuery(createMintingTransactionsTable);
    await runQuery(createPaymentsTable);
    await runQuery(createLikesTable);
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

const getNFTIdByTokenId = async (token_id) => {
  const query = `
    SELECT id FROM nfts WHERE token_id = ?`;

  try {
    const result = await allAsync(query, [token_id]);
    if (result.length === 0) {
      throw new Error("NFT with the given token ID not found.");
    }
    return result[0].id; // Assuming 'id' is your primary key
  } catch (error) {
    console.error("Error fetching NFT ID by token ID:", error);
    throw error;
  }
};


// Function to insert minted NFT into the database
const insertMintedNFT = async ({
  token_id,
  metadata_uri,
  owner_wallet_address,
  collection_name,
  name,
  description,
  properties
}) => {
  const query = `
    INSERT INTO minted_nfts (
      token_id, metadata_uri, owner_wallet_address, collection_name, name, description, properties
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

  try {
    await runQuery(query, [
      token_id,
      metadata_uri,
      owner_wallet_address,
      collection_name,
      name,
      description,
      JSON.stringify(properties || {})
    ]);
    console.log("Minted NFT inserted into the database.");
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      console.warn(`Token ID '${token_id}' already exists.`);
    } else {
      console.error("Error inserting minted NFT:", error);
    }
  }
};

// Function to insert NFT metadata into the database
const insertNFTMetadata = async (nft_id, key, value) => {
  const query = `
    INSERT INTO nft_metadata (nft_id, metadata_key, metadata_value)
    VALUES (?, ?, ?)`;

  try {
    await runQuery(query, [nft_id, key, value]);
    console.log(`Metadata inserted: ${key} = ${value}`);
  } catch (error) {
    console.error("Error inserting NFT metadata:", error);
  }
};



// Example function to handle adding metadata when minting an NFT
const mintNFTWithMetadata = async (nftData, metadata) => {
  try {
    // Insert the NFT into the database first
    await insertMintedNFT(nftData);

    // Insert the associated metadata for the NFT
    const nft_id = await getNFTIdByTokenId(nftData.token_id); // Assuming you have a function to get NFT ID by token_id
    for (const [key, value] of Object.entries(metadata)) {
      await insertNFTMetadata(nft_id, key, value);
    }
    console.log("NFT and metadata successfully minted.");
  } catch (error) {
    console.error("Error minting NFT with metadata:", error);
  }
};

// Example of minting an NFT with relevant data
const mintNFT = async () => {
  try {
    const nftData = {
      token_id: "NFTOKENID123", // Replace with actual token ID
      metadata_uri: "https://example.com/metadata.json", // Replace with actual metadata URI
      owner_wallet_address: "rPLvYSKRUc3vqU3b4guho8Ya5ZC2X5ahYa", // Replace with actual owner wallet address
      collection_name: "MyNFTCollection", // Replace with actual collection name
      name: "Cool Seagull NFT", // NFT Name
      description: "This is a rare Seagull NFT", // NFT Description
      properties: { color: "blue", rarity: "rare" } // Example properties
    };

    // Insert the minted NFT into the database
    await insertMintedNFT(nftData);
    console.log("NFT successfully minted and added to the database.");
  } catch (error) {
    console.error("Error minting NFT:", error);
  }
};

// Call the mintNFT function
mintNFT();


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



const addOwnerWalletAddressToNFTsTable = async () => {
  await addColumnIfNotExists('nfts', 'owner_wallet_address', 'TEXT');
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

const createCollection = async (name, description, logo_uri, created_by) => {
  const query = `
    INSERT INTO collections (name, description, logo_uri, created_by)
    VALUES (?, ?, ?, ?)`;
  try {
    await runQuery(query, [name, description, logo_uri, created_by]);
    console.log("Collection created successfully.");
  } catch (error) {
    console.error("Error creating collection:", error);
  }
};

// Function to update a collection
const updateCollection = async (collectionId, name, description, logo_uri) => {
  const query = `
    UPDATE collections
    SET name = ?, description = ?, logo_uri = ?
    WHERE id = ?`;
  try {
    await runQuery(query, [name, description, logo_uri, collectionId]);
    console.log("Collection updated successfully.");
  } catch (error) {
    console.error("Error updating collection:", error);
  }
};

// NFT Transfer
const transferNFT = async (nft_id, from_wallet, to_wallet) => {
  try {
    const nftQuery = `SELECT * FROM nfts WHERE id = ?`;
    const nft = await allAsync(nftQuery, [nft_id]);

    if (nft.length === 0) {
      throw new Error("NFT not found");
    }

    if (nft[0].owner_wallet_address !== from_wallet) {
      throw new Error("The sender is not the owner of this NFT");
    }

    // Proceed with the transfer logic
    const updateQuery = `
      UPDATE nfts
      SET owner_wallet_address = ?
      WHERE id = ?`;

    await runQuery(updateQuery, [to_wallet, nft_id]);
    console.log("NFT successfully transferred.");
  } catch (error) {
    console.error("Error transferring NFT:", error);
  }
};


// Place a Bid on NFT
const placeBid = async (nft_id, user_wallet, bid_amount) => {
  try {
    const checkNFTQuery = `SELECT * FROM nfts WHERE id = ?`;
    const nft = await allAsync(checkNFTQuery, [nft_id]);

    if (nft.length === 0) {
      throw new Error("NFT not found");
    }

    // Insert bid into the database
    const insertBidQuery = `
      INSERT INTO bids (nft_id, user_wallet, bid_amount)
      VALUES (?, ?, ?)`;
    await runQuery(insertBidQuery, [nft_id, user_wallet, bid_amount]);

    console.log("Bid placed successfully.");
  } catch (error) {
    console.error("Error placing bid:", error);
  }
};

// Like an NFT
const likeNFT = async (nft_id, user_wallet) => {
  try {
    const checkNFTQuery = `SELECT * FROM nfts WHERE id = ?`;
    const nft = await allAsync(checkNFTQuery, [nft_id]);

    if (nft.length === 0) {
      throw new Error("NFT not found");
    }

    // Check if user already liked the NFT
    const checkLikeQuery = `SELECT * FROM likes WHERE nft_id = ? AND user_wallet = ?`;
    const existingLike = await allAsync(checkLikeQuery, [nft_id, user_wallet]);

    if (existingLike.length > 0) {
      throw new Error("User already liked this NFT");
    }

    // Insert like into the database
    const insertLikeQuery = `
      INSERT INTO likes (nft_id, user_wallet)
      VALUES (?, ?)`;
    await runQuery(insertLikeQuery, [nft_id, user_wallet]);

    console.log("NFT liked successfully.");
  } catch (error) {
    console.error("Error liking NFT:", error);
  }
};

// Handle Minting Payments
const mintWithPayment = async (token_id, metadata_uri, owner_wallet_address, collection_name, wallet_address, payment_amount) => {
  try {
    // Validate payment (check if the user has enough SeagullCoin)
    const checkPaymentQuery = `SELECT seagullcoin_balance FROM users WHERE wallet_address = ?`;
    const user = await allAsync(checkPaymentQuery, [wallet_address]);

    if (user.length === 0 || parseFloat(user[0].seagullcoin_balance) < parseFloat(payment_amount)) {
      throw new Error("Insufficient balance for minting");
    }

    // Deduct the SeagullCoin from the user's balance
    const updateBalanceQuery = `UPDATE users SET seagullcoin_balance = seagullcoin_balance - ? WHERE wallet_address = ?`;
    await runQuery(updateBalanceQuery, [payment_amount, wallet_address]);

    // Mint the NFT
    await mintNFTWithMetadata({
  token_id,
  metadata_uri: metadataURL,
  owner_wallet_address: ownerWallet,
  collection_name: "Seagull Collection"
}, {
  name,
  description,
  image_url,
  collectionId,
  mintingWallet
});


    // Record the minting transaction
    const insertTransactionQuery = `
      INSERT INTO minting_transactions (nft_id, wallet_address, amount)
      VALUES (?, ?, ?)`;
    const nft_id = await getNFTIdByTokenId(token_id);
    await runQuery(insertTransactionQuery, [nft_id, wallet_address, payment_amount]);

    console.log("NFT minted and payment processed successfully.");
  } catch (error) {
    console.error("Error minting NFT with payment:", error);
  }
};

// Handle Payment
const recordPayment = async (payload_uuid, wallet_address, amount, token_code, status = "confirmed") => {
  try {
    const query = `
      INSERT INTO payments (payload_uuid, wallet_address, amount, token_code, status)
      VALUES (?, ?, ?, ?, ?)`;
    await runQuery(query, [payload_uuid, wallet_address, amount, token_code, status]);
    console.log("Payment recorded successfully.");
  } catch (error) {
    console.error("Error recording payment:", error);
  }
};

// Delete NFT
const deleteNFT = async (nft_id) => {
  try {
    await runQuery('BEGIN TRANSACTION');
    await runQuery('DELETE FROM nfts WHERE id = ?', [nft_id]);
    await runQuery('COMMIT');
    console.log("NFT deleted successfully.");
  } catch (error) {
    await runQuery('ROLLBACK');
    console.error("Error deleting NFT:", error);
  }
};

// Log an action
const logTransaction = async (nftId, fromWallet, toWallet, amount, transactionType) => {
  const query = `
    INSERT INTO transaction_history (nft_id, from_wallet, to_wallet, amount, transaction_type)
    VALUES (?, ?, ?, ?, ?)`;

  try {
    await runQuery(query, [nftId, fromWallet, toWallet, amount, transactionType]);
    console.log("Transaction logged successfully.");
  } catch (error) {
    console.error("Error logging transaction:", error);
  }
};


export {
  createTables,
  addColumnIfNotExists,
  insertMintedNFT,
  addOwnerWalletAddressToNFTsTable,
  db,
  runAsync,
  allAsync
};

const start = async () => {
  await createTables();
  await addOwnerWalletAddressToNFTsTable();
  await mintNFTWithMetadata({
    token_id,
    metadata_uri: metadataURL,
    owner_wallet_address: ownerWallet,
    collection_name: collectionId
  }, {
    name,
    description,
    image_url
  });
};

(async () => {
  const nftData = {
    token_id: token_id,
    metadata_uri: metadataURL,
    owner_wallet_address: ownerWallet,
    collection_name: "Seagull Legends"
  };

  const metadata = {
    name: name,
    description: description,
    image: image_url,
    attributes: JSON.stringify([
      { trait_type: "Species", value: "Seagull" },
      { trait_type: "Rarity", value: "Rare" },
      { trait_type: "Wingspan", value: "1.8m" }
    ])
  };

  await mintNFTWithMetadata(nftData, metadata);
})();


start();

