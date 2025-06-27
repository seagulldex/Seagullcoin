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

export async function createGenesisTokenAndBlock() {
  const preminedWalletAddress = 'SEAGULLD1DFB4670F7CA58AB0B03B62';

  let preminedWallet = await UserWallet.findOne({ wallet: preminedWalletAddress });
  if (!preminedWallet) {
    preminedWallet = new UserWallet({ wallet: preminedWalletAddress, balance: 0 });
    await preminedWallet.save();
  }

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

  let genesisToken = await Token.findOne({ symbol: 'SGLCN-X20' });
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

  const genesisBlock = new Block(genesisBlockData);
  genesisBlock.hash = calculateHash(genesisBlockData);
  await genesisBlock.save();

  return { genesisToken, genesisBlock };
}

export { calculateHash, createGenesisTokenAndBlock as createGenesisBlock };
