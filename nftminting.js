// nftminting.js

import { xumm } from './xumm-utils.js';
import { NFTStorage, File } from 'nft.storage';
import mime from 'mime';
import { Buffer } from 'buffer';
import { confirmPayment } from './payment.js'; // Importing the payment module

export async function mintNFT(walletAddress, nftData) {
  try {
    // Step 1: Confirm the payment (from a prior payment transaction)
    const paymentConfirmation = await confirmPayment(nftData.txId);
    if (!paymentConfirmation.success) {
      throw new Error('Payment confirmation failed: ' + paymentConfirmation.reason);
    }

    // Step 2: Convert base64 file to File object
    const buffer = Buffer.from(nftData.fileBase64, 'base64');
    const file = new File([buffer], nftData.filename, {
      type: mime.getType(nftData.filename),
    });

    // Step 3: Store metadata in NFT.Storage
    const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
    const metadata = await client.store({
      name: nftData.name,
      description: nftData.description,
      image: file,
      properties: nftData.properties || {},
    });

    // Step 4: Create the minting transaction
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8, // Ensuring the token is transferable
      NFTokenTaxon: 0,
      TransferFee: 0, // No transfer fee for minting
    };

    // Step 5: Create the XUMM payload
    const payload = await xumm.payload.create({ txjson: tx });

    // Step 6: Return the metadata URL and XUMM mint payload URL
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
