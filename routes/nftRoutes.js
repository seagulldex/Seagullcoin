import express from 'express';
import { mintNFT, transferNFT, burnNFT, verifySeagullCoinPayment, rejectXRPOffer } from '../controllers/nftController.js';

const router = express.Router();

// Route to mint a new NFT
router.post('/mint', mintNFT);

// Route to transfer an NFT
router.post('/transfer', transferNFT);

// Route to burn an NFT
router.post('/burn', burnNFT);

// Route to verify SeagullCoin payment
router.post('/verify-payment', verifySeagullCoinPayment);

// Route to reject an XRP offer
router.post('/reject-xrp-offer', rejectXRPOffer);

export default router;
