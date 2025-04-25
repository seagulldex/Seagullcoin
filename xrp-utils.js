import dotenv from 'dotenv';
import { XummSdk } from 'xumm-sdk';
import { Client } from 'xrpl';  // Import XRPL client

dotenv.config();

// Initialize XUMM SDK with API keys
const xumm = new XummSdk({
  apiKey: process.env.XUMM_API_KEY,
  apiSecret: process.env.XUMM_API_SECRET,
});

// XRPL Client setup
const client = new Client('wss://s2.ripple.com'); // XRP Ledger client connection

// Function to check if the wallet has enough SeagullCoin
export async function checkSeagullCoinPayment(wallet, amount) {
  try {
    await client.connect();

    // Retrieve the account's SeagullCoin balance
    const response = await client.request({
      command: 'account_info',
      account: wallet,
      ledger_index: 'validated',
    });

    const balance = response.result.account_data.Balances.find(
      (balance) => balance.currency === 'SGLCN'
    );

    if (!balance) {
      throw new Error('SeagullCoin balance not found.');
    }

    return parseFloat(balance.value) >= parseFloat(amount);
  } catch (error) {
    console.error('Error checking SeagullCoin payment:', error);
    throw new Error('Error checking SeagullCoin payment');
  } finally {
    client.disconnect();
  }
}

// Function to mint an NFT
export async function mintNFT(wallet, metadata) {
  try {
    const mintTransaction = {
      Account: wallet,
      TransactionType: 'NFTokenMint',
      URI: metadata.uri,  // URI to the NFT metadata
      Flags: 0,
    };

    const response = await client.submit(mintTransaction);
    if (response.result && response.result.transaction) {
      return response.result.transaction.hash;
    } else {
      throw new Error('Failed to mint NFT.');
    }
  } catch (error) {
    console.error('Error minting NFT:', error);
    throw new Error('Error minting NFT');
  }
}

// Function to list an NFT for sale with SeagullCoin price
export async function listNFTForSale(wallet, nftId, price) {
  try {
    if (isNaN(price) || price <= 0) {
      throw new Error('Price must be a valid number greater than 0.');
    }

    const listTransaction = {
      Account: wallet,
      TransactionType: 'NFTokenCreateOffer',
      NFTokenID: nftId,
      TakerGets: {
        currency: 'SGLCN',
        value: price,
      },
      TakerPays: {
        currency: 'XRP',
        value: '0',
      },
    };

    const response = await client.submit(listTransaction);
    if (response.result && response.result.transaction) {
      return response.result.transaction.hash;
    } else {
      throw new Error('Failed to list NFT for sale.');
    }
  } catch (error) {
    console.error('Error listing NFT for sale:', error);
    throw new Error('Error listing NFT for sale');
  }
}

// Function to cancel any XRP offers for the given NFT
export async function cancelXrpOffer(wallet, nftId) {
  try {
    const cancelTransaction = {
      Account: wallet,
      TransactionType: 'NFTokenCancelOffer',
      NFTokenID: nftId,
    };

    const response = await client.submit(cancelTransaction);
    if (response.result && response.result.transaction) {
      return response.result.transaction.hash;
    } else {
      throw new Error('Failed to cancel XRP offer.');
    }
  } catch (error) {
    console.error('Error canceling XRP offer:', error);
    throw new Error('Error canceling XRP offer');
  }
}
