import { XummSdk } from 'xumm-sdk';  // Assuming XUMM SDK is installed
import xrpl from 'xrpl';    // Correct way to import the xrpl package

const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;
const XUMM = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET);

const SGLCN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';  // SeagullCoin issuer address
const SGLCN_CURRENCY = '53656167756C6C436F696E000000000000000000';  // SeagullCoin currency code (hex)

const client = new xrpl.Client('wss://s1.ripple.com');  // Connect to the XRP Ledger

// Check if the wallet has enough SeagullCoin balance
export const checkSeagullCoinPayment = async (wallet, amount) => {
  try {
    // Fetch the account's trustline balance for SeagullCoin
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

// Mint the NFT (this is a simplified version)
export const mintNFT = async (wallet, metadata) => {
  try {
    // Create a transaction to mint an NFT on the XRP Ledger (using XUMM)
    const payload = {
      tx_json: {
        TransactionType: 'NFTokenMint',
        Account: wallet,
        // Other fields like metadata, transfer fee, etc.
        NFTokenTaxon: 0,
        Flags: 131072, // to make the token non-fungible
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

// Transfer the NFT to a buyer
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

// List the NFT for sale
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
