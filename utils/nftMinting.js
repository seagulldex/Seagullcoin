import { NFTStorage, File } from 'nft.storage';
import mime from 'mime';
import { Buffer } from 'buffer';
import xumm from '../xumm.js'; // adjust path as needed
import { createNftOfferPayload, verifyXummPayload, getUserInfo } from '../Xumm-utils.js';


const SERVICE_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U';
const SEAGULL_COIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';

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

export async function mintNFT(walletAddress, nftData) {
  try {
    const buffer = Buffer.from(nftData.fileBase64, 'base64');
    const file = new File([buffer], nftData.filename, {
      type: mime.getType(nftData.filename),
    });

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });
    const metadata = await client.store({
      name: nftData.name,
      description: nftData.description,
      image: file,
      properties: nftData.properties || {},
    });

    const tx = {
      TransactionType: 'NFTokenMint',
      Account: walletAddress,
      URI: Buffer.from(metadata.url).toString('hex').toUpperCase(),
      Flags: 8,
      NFTokenTaxon: 0,
      TransferFee: 0
    };

    const payload = await xumm.payload.create({ txjson: tx });

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
