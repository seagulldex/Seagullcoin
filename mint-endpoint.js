import xrpl from 'xrpl'; // at the top of your file
import { Router } from 'express';
import { confirmPayment } from './confirmPaymentXumm.js'; // Correct path
import { mintNFT } from './nftminting.js'; // Import mintNFT from your nftminting.js file
import rippleAddressCodec from 'ripple-address-codec';
import db from './dbsetup.js';
const { isValidAddress } = rippleAddressCodec;
import { insertMintedNFT } from './dbsetup.js'; // adjust path if needed
import logger from './logger.js';
import sanitizeHtml from 'sanitize-html';

nftData.name = sanitizeHtml(nftData.name, { allowedTags: [], allowedAttributes: {} });
nftData.description = sanitizeHtml(nftData.description, { allowedTags: [], allowedAttributes: {} });

// Create a client and connect
const client = new xrpl.Client("wss://xrplcluster.com"); // or your preferred endpoint

// Load your service wallet (replace with actual credentials)
const wallet = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED); // Make sure SERVICE_WALLET_SEED is set in .env

/**
 * Validate an XRP address.
 * @param {string} address - The XRP wallet address to validate.
 * @returns {boolean} - Returns true if the address is valid, otherwise false.
 */
function isValidXRPAddress(address) {
  return isValidAddress(address);
}

const router = Router();

/**
 * POST /mint
 * Endpoint to handle the minting process: confirm payment and mint NFT.
 */
router.post('/mint', async (req, res) => {
  const { walletAddress, nftData, txId } = req.body;

  // Validate wallet address
  if (!walletAddress || !isValidXRPAddress(walletAddress)) {
    return res.status(400).json({ success: false, message: 'Invalid wallet address' });
  }

  // Validate nftData
  if (!nftData || !nftData.name || !nftData.description || !nftData.filename || !nftData.fileBase64) {
    return res.status(400).json({ success: false, message: 'Missing required NFT data' });
  }
  
  if (nftData.collectionId && typeof nftData.collectionId !== 'string') {
  return res.status(400).json({ success: false, message: 'Invalid collection ID' });
}

  try {
    // Step 1: Confirm the payment with the given txId
    const paymentConfirmation = await confirmPayment(txId);
    if (!paymentConfirmation.success) {
      return res.status(400).json({
        success: false,
        message: paymentConfirmation.reason,
      });
    }


// Basic input size checks
if (nftData.name.length > 100 || nftData.description.length > 1000) {
  return res.status(400).json({ success: false, message: 'Name or description too long.' });
}
    try {
  Buffer.from(nftData.fileBase64, 'base64');
} catch (e) {
  return res.status(400).json({ success: false, message: 'Invalid base64 file data.' });
}


const base64Size = Buffer.from(nftData.fileBase64, 'base64').length;
if (base64Size > 5 * 1024 * 1024) { // 5MB limit
  return res.status(400).json({ success: false, message: 'File exceeds 5MB limit.' });
}

// File extension check
const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const isValidExtension = allowedExtensions.some(ext =>
  nftData.filename.toLowerCase().endsWith(ext)
);
if (!isValidExtension) {
  return res.status(400).json({ success: false, message: 'Invalid file type.' });
}

const trackUserMinting = (walletAddress) => {
  return new Promise((resolve, reject) => {
    const checkQuery = `SELECT * FROM users WHERE wallet_address = ?`;
    db.get(checkQuery, [walletAddress], (err, user) => {
      if (err) {
        return reject(err);
      }
      
      if (!user) {
        const insertQuery = `INSERT INTO users (wallet_address) VALUES (?)`;
        db.run(insertQuery, [walletAddress], function (err) {
          if (err) {
            return reject(err);
          }
          resolve(this.lastID);  // Return new user ID
        });
      } else {
        const updateQuery = `UPDATE users SET total_mints = total_mints + 1 WHERE wallet_address = ?`;
        db.run(updateQuery, [walletAddress], function (err) {
          if (err) {
            return reject(err);
          }
          resolve(user.id);  // Return existing user ID
        });
      }
    });
  });
};


    // Step 2: Proceed to mint the NFT
    const mintResult = await mintNFT(walletAddress, nftData); // Call mintNFT, it should handle minting and return the mint result

console.log('NFT Minted:', {
  wallet: walletAddress,
  tokenId: mintResult.tokenId,
  uri: mintResult.uri,
  uriHex: mintResult.uriHex
});

    // Step 2.5: Store the NFT in the database
try {
  await insertMintedNFT({
    wallet: walletAddress,
    token_id: mintResult.tokenId,
    uri: mintResult.uri,
    name: nftData.name,
    description: nftData.description,
    properties: JSON.stringify(nftData.properties || {}),
    collection_id: nftData.collectionId || null
  });
  console.log('NFT successfully stored in DB.');
} catch (err) {
  console.error('Failed to insert NFT into DB:', err.message);
}


    // Step 3: Send the response back to the frontend with mint details
    req.session.mintAllowed = false;
    
    return res.status(200).json({
      success: true,
      nftStorageUrl: mintResult.uri,        // Corrected this to use the URI from mintNFT
      mintPayloadUrl: mintResult.uri,      // Same URI as mintResult.uri
      mintPayloadId: mintResult.uriHex,    // Use the hex-encoded URI
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
 *     components:
 *       schemas:
 *         collectionId:
 *           type: string
 *           description: Optional collection ID to group NFTs
 */
export default router;
