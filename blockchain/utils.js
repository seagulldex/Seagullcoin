import crypto from 'crypto';
import Block from '../models/Block.js';
import Token from '../models/Token.js';
import UserWallet from '../models/UserWallet.js';



function calculateHash(block) {
  return crypto.createHash('sha256')
    .update(
      block.index +
      block.previousHash +
      block.timestamp +
      JSON.stringify(block.transactions) +
      block.nonce
    )
    .digest('hex');
}

export async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  }
}

/**
 * Create genesis token + block, and optionally broadcast it via gossip.
  @param {Function} broadcastFunc - Optional gossip broadcast function
 */
export async function createGenesisTokenAndBlock(broadcastFunc) {
  const preminedWalletAddress = 'SEAGULLD1DFB4670F7CA58AB0B03B62';

  let preminedWallet = await UserWallet.findOne({ wallet: preminedWalletAddress });
  if (!preminedWallet) {
    preminedWallet = new UserWallet({ wallet: preminedWalletAddress, balance: 0 });
    await preminedWallet.save();
  }

  const genesisTokenData = {
    symbol: 'XSC',
    name: 'SeagullCoin',
    owner_wallet: preminedWallet._id,
    max_supply: 589000000,
    circulating_supply: 589000000,
    decimals: 8,
    isGenesisToken: true,
    layer: 'L1',
  };

  let genesisToken = await Token.findOne({ symbol: 'XSC' });
  if (!genesisToken) {
    genesisToken = new Token(genesisTokenData);
    await genesisToken.save();
  }

  const genesisBlockData = {
    index: 0,
    previousHash: '0',
    timestamp: Date.now(),   // number, not Date object
    finalized: false,        // add this
    nonce: 0,
    transactions: [
      {
        txId: 'genesis-mint',
        from: null,
        to: preminedWalletAddress,
        amount: genesisToken.max_supply,
        tokenSymbol: genesisToken.symbol,
        type: 'genesis',
      }
    ],
  };

  const genesisBlock = new Block({
  ...genesisBlockData,
  hash: calculateHash(genesisBlockData)
});

  let genesisBlock = await Block.findOne({ index: 0 });
if (!genesisBlock) {
  genesisBlock = new Block({
    ...genesisBlockData,
    hash: calculateHash(genesisBlockData),
  });
  await genesisBlock.save();
}


  await genesisBlock.save();

  // ✅ Broadcast to gossip network if function is provided
  if (typeof broadcastFunc === 'function') {
    broadcastFunc({
      type: 'BLOCK',
      block: {
        ...genesisBlock.toObject(),
        _id: undefined, // remove Mongo's _id if needed
        __v: undefined
      }
    });
  }

  return { genesisToken, genesisBlock };
}

export { calculateHash, createGenesisTokenAndBlock as createGenesisBlock };
