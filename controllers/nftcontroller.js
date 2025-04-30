import { mintNFT, transferNFT, burnNFT, verifySeagullCoinPayment, rejectXRPOffer } from '../helpers/xrplHelper.js';
import { SEAGULLCOIN_HEX } from '../config/config.js';

// Mint NFT controller
export const mintNFT = async (req, res) => {
  try {
    const { metadata, walletAddress } = req.body;
    const result = await mintNFT(metadata, walletAddress, SEAGULLCOIN_HEX);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error minting NFT:', error);
    res.status(500).json({ error: 'Minting failed' });
  }
};

// Transfer NFT controller
export const transferNFT = async (req, res) => {
  try {
    const { nftId, buyerWallet } = req.body;
    const result = await transferNFT(nftId, buyerWallet, SEAGULLCOIN_HEX);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error transferring NFT:', error);
    res.status(500).json({ error: 'Transfer failed' });
  }
};

// Burn NFT controller
export const burnNFT = async (req, res) => {
  try {
    const { nftId } = req.body;
    const result = await burnNFT(nftId, SEAGULLCOIN_HEX);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error burning NFT:', error);
    res.status(500).json({ error: 'Burning failed' });
  }
};

// Verify SeagullCoin payment controller
export const verifySeagullCoinPayment = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const result = await verifySeagullCoinPayment(walletAddress, SEAGULLCOIN_HEX);
    res.status(200).json({ verified: result });
  } catch (error) {
    console.error('Error verifying SeagullCoin payment:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};

// Reject XRP offer controller
export const rejectXRPOffer = async (req, res) => {
  try {
    const { nftId } = req.body;
    const result = await rejectXRPOffer(nftId, SEAGULLCOIN_HEX);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error rejecting XRP offer:', error);
    res.status(500).json({ error: 'Rejecting XRP offer failed' });
  }
};
