// mint-endpoint.js
import { Router } from 'express';
import { confirmPayment } from './confirmPaymentxumm.js'; // Correct path
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

/**
 * @swagger
 * /mint:
 *   post:
 *     summary: Mint an NFT after confirming SeagullCoin payment
 *     description: Requires a valid txId of 0.5 SeagullCoin payment and metadata for the NFT.
 *     tags:
 *       - Minting
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: XRPL wallet address of the user
 *               nftData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   filename:
 *                     type: string
 *                   fileBase64:
 *                     type: string
 *                   properties:
 *                     type: object
 *                 required:
 *                   - name
 *                   - description
 *                   - filename
 *                   - fileBase64
 *               txId:
 *                 type: string
 *                 description: XUMM transaction ID for SeagullCoin payment
 *     responses:
 *       200:
 *         description: Minting initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 nftStorageUrl:
 *                   type: string
 *                 mintPayloadUrl:
 *                   type: string
 *                 mintPayloadId:
 *                   type: string
 *       400:
 *         description: Invalid payment or input
 *       500:
 *         description: Server error during minting
 */


export default router;
