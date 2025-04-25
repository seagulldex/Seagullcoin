import dotenv from 'dotenv';
dotenv.config()// Log API keys to ensure they are loaded properly
console.log('XUMM API Key:', process.env.XUMM_API_KEY);
console.log('XUMM API Secret:', process.env.XUMM_API_SECRET);

if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
  throw new Error('Invalid API Key and/or API Secret. Please check your .env file.');
}
;  // Loads the environment variables from .env
import { XummSdk } from 'xumm-sdk';  // Assuming you have xumm-sdk installed
import pkg from 'xrpl';  // XRP Client import
const { XRPClient } = pkg;

// Log API keys to ensure they are loaded properly
console.log('XUMM API Key:', process.env.XUMM_API_KEY);
console.log('XUMM API Secret:', process.env.XUMM_API_SECRET);

if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
  throw new Error('Invalid API Key and/or API Secret. Please check your .env file.');
}

// Initialize XUMM SDK with the API keys
const XUMM = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_API_SECRET);

// Define constants for SeagullCoin
const SGLCN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';  // SeagullCoin issuer address
const SGLCN_CURRENCY = '53656167756C6C436F696E000000000000000000';  // SeagullCoin currency code (hex)

// Initialize XRP Client
const client = new XRPClient('wss://s1.ripple.com');  // Connect to the XRP Ledger

// Function to check if the wallet has enough SeagullCoin
export const checkSeagullCoinPayment = async (wallet, amount) => {
  try {
    const response = await client.request({
      method: 'account_lines',
      params: [{ account: wallet }],
    });

    const seagullCoinBalance = response.result.lines.find(line => line.currency === SGLCN_CURRENCY && line.account === SGLCN_ISSUER);

    if (!seagullCoinBalance || parseFloat(seagullCoinBalance.balance) < amount) {
      return false;  // Not enough balance
    }
    return true;
  } catch (error) {
    console.error('Error checking SeagullCoin balance:', error);
    return false;
  }
};

// Function to mint NFT
export const mintNFT = async (wallet, metadata) => {
  try {
    const payload = {
      tx_json: {
        TransactionType: 'NFTokenMint',
        Account: wallet,
        NFTokenTaxon: 0,
        Flags: 131072, // Non-fungible token flag
      },
      metadata: metadata,
    };

    const response = await XUMM.payload.create(payload);
    return response?.meta?.txn_id;  // Return the transaction ID as the NFT ID
  } catch (error) {
    console.error('Error minting NFT:', error);
    return null;
  }
};

// Function to list NFT for sale with SeagullCoin only
export const listNFTForSale = async (wallet, nftId, price) => {
  try {
    const payload = {
      tx_json: {
        TransactionType: 'NFTokenCreateOffer',
        Account: wallet,
        NFTokenID: nftId,
        Amount: {
          currency: SGLCN_CURRENCY,
          value: price.toString(),
          issuer: SGLCN_ISSUER,
        },
      },
    };

    const response = await XUMM.payload.create(payload);
    return response?.meta?.txn_id;  // Return the transaction ID for listing the NFT
  } catch (error) {
    console.error('Error listing NFT for sale:', error);
    return null;
  }
};

// Function to transfer NFT to a buyer (SeagullCoin only)
export const transferNFT = async (wallet, nftId) => {
  try {
    const payload = {
      tx_json: {
        TransactionType: 'NFTokenCreateOffer',
        Account: wallet,
        NFTokenID: nftId,
        Amount: {
          currency: SGLCN_CURRENCY,
          value: '0.5',
          issuer: SGLCN_ISSUER,
        },
      },
    };

    const response = await XUMM.payload.create(payload);
    return response?.meta?.txn_id;  // Return the transaction ID of the transfer
  } catch (error) {
    console.error('Error transferring NFT:', error);
    return null;
  }
};

// Function to cancel XRP offers if detected
export const cancelXrpOffer = async (wallet, nftId) => {
  try {
    const payload = {
      tx_json: {
        TransactionType: 'NFTokenCancelOffer',
        Account: wallet,
        NFTokenID: nftId,
      },
    };

    const response = await XUMM.payload.create(payload);
    return response?.meta?.txn_id;  // Return the transaction ID of the cancellation
  } catch (error) {
    console.error('Error cancelling XRP offer:', error);
    return null;
  }
};
