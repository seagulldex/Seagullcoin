import fs from 'fs';
import fetch from 'node-fetch';
import { NFTStorage, File } from 'nft.storage';
import { XUMM_API_URL, NFT_STORAGE_API_KEY, SGLCN_ISSUER, SERVICE_WALLET, XUMM_API_KEY } from './config.js';
import { fileTypeFromBuffer } from 'file-type'; // Correct import

// Set up NFT.Storage client
const nftStorageClient = new NFTStorage({ token: NFT_STORAGE_API_KEY });

/** Check if a specific wallet address owns a given NFT ID */
export const checkOwnership = async (nftId, walletAddress) => {
  try {
    const response = await fetch(`${XUMM_API_URL}/nft/${nftId}`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const nftDetails = await response.json();

    if (nftDetails?.nft?.Owner) {
      return nftDetails.nft.Owner.toLowerCase() === walletAddress.toLowerCase();
    }
    console.error('NFT details not found or malformed', nftDetails);
    return false;
  } catch (error) {
    console.error('Error checking NFT ownership:', error);
    return false;
  }
};

/** Verify if user paid 0.5 SeagullCoin for minting */
export const verifySeagullCoinPayment = async (walletAddress) => {
  try {
    const response = await fetch(`${XUMM_API_URL}/user/${walletAddress}/payments`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const data = await response.json();

    if (!data.payments) return false;

    return data.payments.some(payment =>
      payment.amount === '0.5' && payment.currency === 'SGLCN-X20'
    );
  } catch (error) {
    console.error('Error verifying SeagullCoin payment:', error);
    return false;
  }
};

/** Helper to detect MIME type dynamically */
const getMimeType = async (filePath) => {
  const buffer = await fs.promises.readFile(filePath);
  const type = await fileTypeFromBuffer(buffer);
  return type ? type.mime : 'application/octet-stream';
};

/** Upload metadata and mint the NFT */
export const mintNFT = async (metadata, walletAddress) => {
  try {
    // Confirm payment before minting
    const paymentVerified = await verifySeagullCoinPayment(walletAddress);
    if (!paymentVerified) throw new Error('SeagullCoin payment not verified.');

    const fileBuffer = await fs.promises.readFile(metadata.file);
    const mimeType = await getMimeType(metadata.file);
    const fileData = new File([fileBuffer], metadata.file, { type: mimeType });

    const metadataObj = {
      name: metadata.name,
      description: metadata.description,
      domain: metadata.domain,
      properties: metadata.properties,
      image: fileData,
    };

    const storedMetadata = await nftStorageClient.store(metadataObj);

    const mintPayload = {
      transaction: {
        TransactionType: 'NFTokenMint',
        Account: walletAddress,
        URI: `ipfs://${storedMetadata.ipnft}`,
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

    return mintData;
  } catch (error) {
    console.error('Error minting NFT:', error);
    throw error;
  }
};

/** Confirm SeagullCoin transaction for buying NFTs */
export const verifySeagullCoinTransaction = async (walletAddress, price) => {
  try {
    const response = await fetch(`${XUMM_API_URL}/user/${walletAddress}/transactions`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const data = await response.json();

    if (!data.transactions) return false;

    return data.transactions.some(tx =>
      tx.amount === price.toString() && tx.currency === 'SGLCN-X20'
    );
  } catch (error) {
    console.error('Error verifying SeagullCoin transaction:', error);
    return false;
  }
};

/** Transfer NFT by creating an offer */
export const transferNFT = async (nftId, buyerWallet) => {
  try {
    const transferPayload = {
      transaction: {
        TransactionType: 'NFTokenCreateOffer',
        Account: SERVICE_WALLET,
        NFTokenID: nftId,
        Taker: buyerWallet,
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000', // SeagullCoin hex
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
