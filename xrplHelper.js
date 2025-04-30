import fetch from 'node-fetch';
import { XUMM_API_URL, XUMM_API_KEY, SEAGULLCOIN_HEX, SERVICE_WALLET } from '../config/config.js';

// Helper to verify SeagullCoin payment
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
      
      return tx.txjson.Amount.currency === SEAGULLCOIN_HEX 
        && tx.txjson.Amount.issuer === SERVICE_WALLET
        && parseFloat(tx.txjson.Amount.value) >= 0.5;
    });
  } catch (error) {
    console.error('Error verifying SeagullCoin payment:', error);
    return false;
  }
};

// Mint NFT function
export const mintNFT = async (metadata, walletAddress, seagullCoinHex) => {
  // Minting logic here, using the SeagullCoin hex as needed
  // For brevity, this example just returns a mocked response.
  return { success: true, metadata, walletAddress };
};

// Transfer NFT function
export const transferNFT = async (nftId, buyerWallet, seagullCoinHex) => {
  // Transfer logic using SeagullCoin and the hex
  return { success: true, nftId, buyerWallet };
};

// Burn NFT function
export const burnNFT = async (nftId, seagullCoinHex) => {
  // Burning logic for SeagullCoin NFTs
  return { success: true, nftId };
};

// Reject XRP offer function
export const rejectXRPOffer = async (nftId, seagullCoinHex) => {
  // Reject offer logic for SeagullCoin NFTs only
  return { success: true, nftId };
};
