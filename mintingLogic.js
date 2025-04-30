import fs from 'fs';
import fetch from 'node-fetch';
import { NFTStorage, File } from 'nft.storage';
import { XUMM_API_URL, NFT_STORAGE_API_KEY, SGLCN_ISSUER, SERVICE_WALLET, XUMM_API_KEY } from './config.js';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import { Buffer } from 'buffer';
import xrpl from 'xrpl';

const nftStorageClient = new NFTStorage({ token: NFT_STORAGE_API_KEY });
const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

async function connectWithRetry(retryAttempts = 5, delayMs = 1000) {
  let attempts = 0;
  while (attempts < retryAttempts) {
    try {
      if (!client.isConnected()) {
        await client.connect();
        isConnected = true;
        console.log("Connected to XRPL node.");
        return;
      }
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} to connect failed. Retrying in ${delayMs}ms...`);
      if (attempts >= retryAttempts) {
        throw new Error('Failed to connect after multiple attempts.');
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function ensureConnected() {
  if (!isConnected) {
    await connectWithRetry();
  }
}

export async function getNFTDetails(nftId) {
  try {
    await ensureConnected();

    const response = await client.request({
      command: "nft_info",
      nft_id: nftId,
    });

    if (response.result && response.result.nft_info) {
      const nftData = response.result.nft_info;
      return {
        nftId: nftId,
        owner: nftData.Owner,
        uri: nftData.URI,
        flags: nftData.Flags,
        transferFee: nftData.TransferFee,
        issuer: nftData.Issuer,
      };
    } else {
      console.error('No NFT info found for', nftId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching NFT details from XRPL:', error);
    return null;
  }
}

export async function disconnectClient() {
  if (client.isConnected()) {
    await client.disconnect();
    isConnected = false;
    console.log('Disconnected from XRPL node.');
  }
}

export { client };

const getMimeType = async (filePath) => {
  const buffer = await fs.promises.readFile(filePath);
  const type = await fileTypeFromBuffer(buffer);
  return type ? type.mime : 'application/octet-stream';
};

export const checkOwnership = async (nftId, walletAddress) => {
  try {
    const nftDetails = await getNFTDetails(nftId);
    if (nftDetails && nftDetails.owner) {
      return nftDetails.owner.toLowerCase() === walletAddress.toLowerCase();
    }
    console.error('NFT details not found for', nftId);
    return false;
  } catch (error) {
    console.error('Error checking NFT ownership:', error);
    return false;
  }
};

export const verifySeagullCoinPayment = async (walletAddress) => {
  try {
    const response = await fetch(`${XUMM_API_URL}/user/${walletAddress}/transactions`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const data = await response.json();

    if (!data.transactions) return false;

    return data.transactions.some(tx => {
      if (tx.txjson.TransactionType !== 'Payment') return false;
      if (!tx.txjson.Amount || typeof tx.txjson.Amount !== 'object') return false;
      
      return tx.txjson.Amount.currency === '53656167756C6C436F696E000000000000000000' // SeagullCoin hex
        && tx.txjson.Amount.issuer === SGLCN_ISSUER
        && parseFloat(tx.txjson.Amount.value) >= 0.5;
    });
  } catch (error) {
    console.error('Error verifying SeagullCoin payment:', error);
    return false;
  }
};

export const mintNFT = async (metadata, walletAddress) => {
  try {
    const paymentVerified = await verifySeagullCoinPayment(walletAddress);
    if (!paymentVerified) throw new Error('SeagullCoin payment not verified.');

    const fileBuffer = await fs.promises.readFile(metadata.file);
    const mimeType = await getMimeType(metadata.file);
    const fileName = path.basename(metadata.file);
    const fileData = new File([fileBuffer], fileName, { type: mimeType });

    const metadataObj = {
      name: metadata.name,
      description: metadata.description,
      domain: metadata.domain,
      properties: metadata.properties,
      image: fileData,
    };

    const storedMetadata = await nftStorageClient.store(metadataObj);
    const ipfsUri = `ipfs://${storedMetadata.ipnft}`;
    const uriHex = Buffer.from(ipfsUri, 'utf8').toString('hex');

    const mintPayload = {
      transaction: {
        TransactionType: 'NFTokenMint',
        Account: walletAddress,
        URI: uriHex,
        Flags: 0x8000, // Transferable
        TokenTaxon: 0,
      },
    };

    const mintResponse = await fetch(`${XUMM_API_URL}/payload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
      body: JSON.stringify(mintPayload),
    });

    const mintData = await mintResponse.json();
    if (!mintData.success) throw new Error('Minting failed');

    return {
      success: true,
      payload: mintData,
      metadataCid: storedMetadata.ipnft,
      uriHex,
    };
  } catch (error) {
    console.error('Error minting NFT:', error);
    throw error;
  }
};

export const transferNFT = async (nftId, buyerWallet) => {
  try {
    const transferPayload = {
      transaction: {
        TransactionType: 'NFTokenCreateOffer',
        Account: SERVICE_WALLET,
        NFTokenID: nftId,
        Taker: buyerWallet,
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000',
          issuer: SGLCN_ISSUER,
          value: '0.5',
        },
        Flags: 0,
      },
    };

    const transferResponse = await fetch(`${XUMM_API_URL}/payload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
      body: JSON.stringify(transferPayload),
    });

    const transferData = await transferResponse.json();
    if (!transferData.success) throw new Error('NFT transfer failed');

    return transferData;
  } catch (error) {
    console.error('Error transferring NFT:', error);
    throw error;
  }
};

export const rejectXRPOffer = async (nftId) => {
  try {
    const rejectOfferPayload = {
      transaction: {
        TransactionType: 'NFTokenCancelOffer',
        Account: SERVICE_WALLET,
        NFTokenID: nftId,
      },
    };

    const rejectResponse = await fetch(`${XUMM_API_URL}/payload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
      body: JSON.stringify(rejectOfferPayload),
    });

    const rejectData = await rejectResponse.json();
    if (!rejectData.success) throw new Error('Offer rejection failed');

    return rejectData;
  } catch (error) {
    console.error('Error rejecting XRP offer:', error);
    throw error;
  }
};

export const burnNFTLogic = async (nftId) => {
  try {
    const burnPayload = {
      transaction: {
        TransactionType: 'NFTokenBurn',
        Account: SERVICE_WALLET,
        NFTokenID: nftId,
      },
    };

    const burnResponse = await fetch(`${XUMM_API_URL}/payload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
      body: JSON.stringify(burnPayload),
    });

    const burnData = await burnResponse.json();
    if (!burnData.success) throw new Error('NFT burning failed');

    return burnData;
  } catch (error) {
    console.error('Error burning NFT:', error);
    throw error;
  }
};
