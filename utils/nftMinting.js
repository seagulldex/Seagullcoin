import { xumm } from '../Xumm-utils.js';  // Importing xumm from Xumm-utils.js
import { NFTStorage, File } from 'nft.storage';
import mime from 'mime';
import { Buffer } from 'buffer';

const SERVICE_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';
const SEAGULL_COIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';

/**
 * Confirms that the payment transaction matches the required SeagullCoin (0.5) payment.
 * @param {string} txId - The transaction ID to confirm.
 * @returns {Object} - Result of payment confirmation.
 */
export async function confirmPayment(txId) {
  try {
    const tx = await xumm.payload.get(txId);
    if (tx.meta.signed !== true || !tx.response.txid) {
      return { success: false, reason: 'Transaction not signed or not resolved.' };
    }
    const txResult = await xumm.getTransaction(tx.response.txid);
    const txData = txResult.transaction;
    const amount = txData.Amount;
    const correctPayment =
      txData.Destination === SERVICE_WALLET &&
      typeof amount === 'object' &&
      amount.currency === 'SGLCN-X20' &&
      amount.issuer === SEAGULL_COIN_ISSUER &&
      parseFloat(amount.value) >= 0.5;

    if (!correctPayment) {
      return { success: false, reason: 'Payment does not match requirements.' };
    }

    return { success: true, txid: tx.response.txid };
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    return { success: false, reason: 'Error checking payment status.' };
  }
}

/**
 * Mints an NFT using the provided wallet address and metadata.
 * @param {string} walletAddress - The user's wallet address to mint the NFT.
 * @param {Object} nftData - The NFT metadata, including name, description, file, etc.
 * @returns {Object} - Contains the NFT storage URL and XUMM payload URL.
 */
export async function mintNFT(walletAddress, nftData) {
  try {
    // Convert base64 file to File object
    const buffer = Buffer.from(nftData.fileBase64, 'base64');
    const file = new File([buffer], nftData.filename, {
      type: mime.getType(nftData.filename),
    });

    // Store metadata in NFT.Storage
    const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
    const metadata = await client.store({
      name: nftData.name,
      description: nftData.description,
      image: file,
      properties: nftData.properties || {},
    });

    // Create the minting transaction
    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8, // Ensuring the token is transferable
      NFTokenTaxon: 0,
      TransferFee: 0, // No transfer fee for minting
    };

    // Create the XUMM payload
    const payload = await xumm.payload.create({ txjson: tx });

    // Return the metadata URL and XUMM mint payload URL
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
