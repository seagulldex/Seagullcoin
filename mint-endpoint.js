// mint-endpoint.js
import { Router } from 'express';
import { confirmPayment } from './nftminting.js'; // Import confirmPayment from your nftminting.js file
import { mintNFT } from './nftminting.js'; // Import mintNFT from your nftminting.js file

const router = Router();

/**
 * POST /mint
 * Endpoint to handle the minting process: confirm payment and mint NFT.
 */
router.post('/mint', async (req, res) => {
  const { walletAddress, nftData, txId } = req.body;

  try {
    // Step 1: Confirm the payment with the given txId
    const paymentConfirmation = await confirmPayment(txId);
    if (!paymentConfirmation.success) {
      return res.status(400).json({
        success: false,
        message: paymentConfirmation.reason,
      });
    }

    // Step 2: Proceed to mint the NFT
    const mintResult = await mintNFT(walletAddress, nftData);

    // Step 3: Send the response back to the frontend with mint details
    return res.status(200).json({
      success: true,
      nftStorageUrl: mintResult.nftStorageUrl,
      mintPayloadUrl: mintResult.mintPayloadUrl,
      mintPayloadId: mintResult.mintPayloadId,
    });

  } catch (error) {
    console.error('Minting process failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during the minting process.',
    });
  }
});

export default router;
