import crypto from 'crypto';

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
  const genesisBlock = new Block({
    index: 0,
    previousHash: '0',
    timestamp: new Date(),
    transactions: [],
    nonce: 0,
  });

  genesisBlock.hash = calculateHash(genesisBlock);
  await genesisBlock.save();
  return genesisBlock;
}
