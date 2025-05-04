// nftminting.js
import { xumm } from './xumm-utils.js';
import { NFTStorage, File } from 'nft.storage';
import mime from 'mime';
import { Buffer } from 'buffer';
import { confirmPayment } from './confirmPaymentXumm.js';  // Import from server.js, not payment.js

export async function mintNFT(walletAddress, nftData) {
  try {
    // Basic validation for the wallet address (make sure it's a valid XRPL address)
    if (!/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(walletAddress)) {
      throw new Error('Invalid XRPL wallet address.');
    }

    // Step 1: Convert base64 file to File object
    const buffer = Buffer.from(nftData.fileBase64, 'base64');
    const file = new File([buffer], nftData.filename, {
      type: mime.getType(nftData.filename),
    });

    // Step 2: Store metadata in NFT.Storage
    const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
    const metadata = await client.store({
      name: nftData.name,
      description: nftData.description,
      image: file,
      properties: nftData.properties || {},
    });

    // Step 3: Ensure that minting is only allowed with SeagullCoin (SGLCN-X20)
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8, // Ensuring the token is transferable
      NFTokenTaxon: 0,
      TransferFee: 0, // No transfer fee for minting
      Amount: {
        currency: 'SeagullCoin',  // Only SeagullCoin is allowed for minting
        issuer: 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno', // SeagullCoin issuer address
        value: '0.5', // 0.5 SeagullCoin required for minting
      },
    };

    // Step 4: Create the XUMM payload for SeagullCoin transaction
    const payload = await xumm.payload.create({ txjson: tx });

    // Step 5: Return the metadata URL and XUMM mint payload URL
    return {
      nftStorageUrl: metadata.url,
      mintPayloadUrl: `https://xumm.app/sign/${payload.uuid}`,
      mintPayloadId: payload.uuid,
    };
  } catch (err) {
    console.error('Minting failed:', err);
    throw new Error('Minting failed: ' + err.message);
  }
}
