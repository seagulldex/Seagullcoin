import crypto from 'crypto';
import Block from './models/Block.js';
import Token from './models/Token.js';
import UserWallet from './models/UserWallet.js';

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

export async function createGenesisTokenAndBlock() {
  // 1. Create premined wallet or find existing
  const preminedWalletAddress = 'SEAGULLD1DFB4670F7CA58AB0B03B62'; // example
  let preminedWallet = await UserWallet.findOne({ wallet: preminedWalletAddress });
  if (!preminedWallet) {
    preminedWallet = new UserWallet({
      wallet: preminedWalletAddress,
      balance: 0,
      // add other fields if needed
    });
    await preminedWallet.save();
  }

  // 2. Create Genesis Token
  const genesisTokenData = {
    symbol: 'SGLCN-X20',
    name: 'SeagullCoin',
    owner_wallet: preminedWallet._id,
    max_supply: 589000000,
    circulating_supply: 589000000,
    decimals: 0,
    isGenesisToken: true,
    layer: 'L1',
  };

  let genesisToken = await Token.findOne({ symbol: 'SEAGULL' });
  if (!genesisToken) {
    genesisToken = new Token(genesisTokenData);
    await genesisToken.save();
  }

  // 3. Create Genesis Block with initial token distribution
  const genesisBlock = new Block({
    index: 0,
    previousHash: '0',
    timestamp: new Date(),
    transactions: [
      {
        from: null,
        to: preminedWalletAddress,
        amount: genesisToken.max_supply,
        tokenSymbol: genesisToken.symbol,
        type: 'genesis',
      }
    ],
    nonce: 0,
  });

  genesisBlock.hash = calculateHash(genesisBlock);
  await genesisBlock.save();

  return { genesisToken, genesisBlock };
}
