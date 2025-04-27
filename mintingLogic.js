// mintingLogic.js
import fetch from 'node-fetch';
import { NFTStorage, File } from 'nft.storage';
import { XUMM_API_URL, NFT_STORAGE_API_KEY, SGLCN_ISSUER, SERVICE_WALLET } from './config.js'; // Ensure to create config.js for your constants

// Set up NFT.Storage client
const nftStorageClient = new NFTStorage({ token: NFT_STORAGE_API_KEY });

// Function to mint the NFT
export const mintNFT = async (metadata, walletAddress) => {
  try {
    const file = await fs.promises.readFile(metadata.file);
    const fileData = new File([file], metadata.file, { type: 'image/jpeg' });

    const metadataObj = {
      name: metadata.name,
      description: metadata.description,
      domain: metadata.domain,
      properties: metadata.properties,
      image: fileData,
    };

    // Upload metadata to NFT.Storage
    const metadataCID = await nftStorageClient.store(metadataObj);

    // Use metadataCID to create the NFT on the XRPL
    const mintPayload = {
      transaction: {
        Account: walletAddress,
        TransactionType: 'NFTokenMint',
        Flags: 0x8000, // Allow token transfer
        URI: `ipfs://${metadataCID}`,
        Issuer: SGLCN_ISSUER,
        TokenTaxon: 0,
      },
    };

    const mintResponse = await fetch(XUMM_API_URL + '/payload', {
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

// Function to verify SeagullCoin payment for minting
export const verifySeagullCoinPayment = async (session) => {
  try {
    // Verify the payment via the XUMM API and session details
    const response = await fetch(`${XUMM_API_URL}/user/${session.walletAddress}/payments`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });
    const data = await response.json();

    // Logic to verify if 0.5 SeagullCoin has been paid
    const paymentVerified = data.payments.some(payment => payment.amount === 0.5 && payment.currency === 'SGLCN-X20');
    return paymentVerified;
  } catch (error) {
    console.error('Error verifying SeagullCoin payment:', error);
    return false;
  }
};

// Function to verify SeagullCoin transaction for buying NFTs
export const verifySeagullCoinTransaction = async (session, price) => {
  try {
    // Verify transaction details
    const response = await fetch(`${XUMM_API_URL}/user/${session.walletAddress}/transactions`, {
      headers: { 'Authorization': `Bearer ${XUMM_API_KEY}` },
    });

    const data = await response.json();

    // Check if the transaction is valid for the specified price
    const transactionValid = data.transactions.some(tx => tx.amount === price && tx.currency === 'SGLCN-X20');
    return transactionValid;
  } catch (error) {
    console.error('Error verifying SeagullCoin transaction:', error);
    return false;
  }
};

// Function to transfer the NFT (after purchase)
export const transferNFT = async (nftId, buyerWallet) => {
  try {
    const transferPayload = {
      transaction: {
        Account: SERVICE_WALLET,
        TransactionType: 'NFTokenCreateOffer',
        NFTokenID: nftId,
        OfferType: 1, // Sell
        Taker: buyerWallet,
        Amount: '0.5',
        Currency: 'SGLCN-X20',
        Flags: 0,
      },
    };

    const transferResponse = await fetch(XUMM_API_URL + '/payload', {
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
