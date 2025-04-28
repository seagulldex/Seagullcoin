import fs from 'fs';
import fetch from 'node-fetch';
import { NFTStorage, File } from 'nft.storage';
import { XUMM_API_URL, NFT_STORAGE_API_KEY, SGLCN_ISSUER, SERVICE_WALLET, XUMM_API_KEY } from './config.js';
import { Client } from 'xrpl';
import { fileTypeFromBuffer } from 'file-type'; // Corrected import for file-type

// Set up NFT.Storage client
const nftStorageClient = new NFTStorage({ token: NFT_STORAGE_API_KEY });

// Function to check if the user owns the NFT
export const checkOwnership = async (nftId, walletAddress) => {
  try {
    const nftDetailsResponse = await fetch(`${XUMM_API_URL}/nft/${nftId}`);
    const nftDetails = await nftDetailsResponse.json();

    if (nftDetails.owner === walletAddress) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking NFT ownership:', error);
    return false;
  }
};

// Function to verify SeagullCoin payment for minting
export const verifySeagullCoinPayment = async ({ walletAddress }) => {
  try {
    const response = await fetch(`${XUMM_API_URL}/user/${walletAddress}/payments`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const data = await response.json();

    const paymentVerified = data.payments.some(payment =>
      payment.amount === 0.5 && payment.currency === 'SGLCN-X20'
    );

    if (!paymentVerified) {
      console.error('SeagullCoin payment verification failed.');
    }
    return paymentVerified;
  } catch (error) {
    console.error('Error verifying SeagullCoin payment:', error);
    return false;
  }
};

// Function to detect MIME type dynamically based on file content
const getMimeType = async (filePath) => {
  const buffer = fs.readFileSync(filePath); // Read file buffer
  const type = await fileTypeFromBuffer(buffer); // Detect MIME type from buffer
  return type ? type.mime : 'application/octet-stream'; // Default MIME type if not detected
};

// Function to mint the NFT
export const mintNFT = async (metadata, walletAddress) => {
  try {
    const paymentVerified = await verifySeagullCoinPayment({ walletAddress });
    if (!paymentVerified) {
      throw new Error('SeagullCoin payment not verified.');
    }

    // Read file and detect MIME type
    const fileBuffer = await fs.promises.readFile(metadata.file);
    const mimeType = await getMimeType(metadata.file);
    const fileData = new File([fileBuffer], metadata.file, { type: mimeType });

    const metadataObj = {
      name: metadata.name,
      description: metadata.description,
      domain: metadata.domain,
      properties: metadata.properties,
      image: fileData, // File to upload to IPFS
    };

    // Store metadata on NFT.Storage
    const storedMetadata = await nftStorageClient.store(metadataObj);

    // Prepare minting payload
    const mintPayload = {
      transaction: {
        TransactionType: 'NFTokenMint',
        Account: walletAddress,
        URI: `ipfs://${storedMetadata.ipnft}`, // IPFS URL
        Flags: 0x8000, // Transferable flag
        TokenTaxon: 0, // Optional token taxon (if needed)
      },
    };

    // Send the minting transaction to XUMM
    const mintResponse = await fetch(XUMM_API_URL + '/payload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
      body: JSON.stringify(mintPayload),
    });

    const mintData = await mintResponse.json();
    if (!mintData.success) throw new Error('Minting failed');

    return mintData; // Return the mint response
  } catch (error) {
    console.error('Error minting NFT:', error);
    throw error;
  }
};

// Function to verify SeagullCoin transaction for buying NFTs
export const verifySeagullCoinTransaction = async ({ walletAddress }, price) => {
  try {
    const response = await fetch(`${XUMM_API_URL}/user/${walletAddress}/transactions`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const data = await response.json();

    // Check for a valid transaction matching the expected price
    const transactionValid = data.transactions.some(tx =>
      tx.amount === price && tx.currency === 'SGLCN-X20'
    );

    if (!transactionValid) {
      console.error('SeagullCoin transaction verification failed.');
    }

    return transactionValid;
  } catch (error) {
    console.error('Error verifying SeagullCoin transaction:', error);
    return false;
  }
};

// Function to transfer NFT
export const transferNFT = async (nftId, buyerWallet) => {
  try {
    const transferPayload = {
      transaction: {
        TransactionType: 'NFTokenCreateOffer',
        Account: SERVICE_WALLET, // Service wallet initiating the offer
        NFTokenID: nftId, // The ID of the NFT to transfer
        Taker: buyerWallet, // The buyer's wallet
        Amount: {
          currency: '53656167756C6C436F696E000000000000000000', // SeagullCoin in hex
          issuer: SGLCN_ISSUER, // SeagullCoin issuer
          value: '0.5', // SeagullCoin payment amount
        },
        Flags: 0, // No flags
      },
    };

    // Send the transfer payload to XUMM
    const transferResponse = await fetch(XUMM_API_URL + '/payload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
      body: JSON.stringify(transferPayload),
    });

    const transferData = await transferResponse.json();
    if (!transferData.success) throw new Error('NFT transfer failed');

    return transferData; // Return transfer result
  } catch (error) {
    console.error('Error transferring NFT:', error);
    throw error;
  }
};
