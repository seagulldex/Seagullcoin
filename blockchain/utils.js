import crypto from 'crypto';
import Block from './models/Block.js'; // adjust path if needed

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

async function createGenesisBlock() {
  const preminedWallet = 'SEAGULLD1DFB4670F7CA58AB0B03B62';  // Your special wallet address
  const initialBalance = 589000000; // Amount of tokens premined


const genesisBlock = new Block({
    index: 0,
    previousHash: '0',
    timestamp: new Date(),
    transactions: [
      {
        from: null, // No sender for genesis tokens
        to: preminedWallet,
        amount: initialBalance,
        type: 'genesis'  // optional, to identify transaction type
      }
    ],
    nonce: 0,
  });

  genesisBlock.hash = calculateHash(genesisBlock);
  await genesisBlock.save();
  return genesisBlock;
}

export { calculateHash, createGenesisBlock };
