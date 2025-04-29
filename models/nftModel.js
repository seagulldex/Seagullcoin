// models/nftModel.js
import fs from 'fs';
const filePath = './data/nfts.json';

function readNFTs() {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath));
}

function writeNFTs(nfts) {
  fs.writeFileSync(filePath, JSON.stringify(nfts, null, 2));
}

const NFTModel = {
  getAll: () => readNFTs(),

  save: (nft) => {
    const nfts = readNFTs();
    nfts.push(nft);
    writeNFTs(nfts);
  },

  getById: (id) => readNFTs().find(nft => nft.id === id),

  update: (id, updatedNft) => {
    const nfts = readNFTs();
    const index = nfts.findIndex(n => n.id === id);
    if (index !== -1) {
      nfts[index] = { ...nfts[index], ...updatedNft };
      writeNFTs(nfts);
    }
  },

  delete: (id) => {
    const nfts = readNFTs().filter(nft => nft.id !== id);
    writeNFTs(nfts);
  }
};

export default NFTModel;
