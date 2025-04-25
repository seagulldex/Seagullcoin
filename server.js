import express from 'express';
import cors from 'cors';
import xrpl from 'xrpl';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import { XummSdk } from 'xumm-sdk';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// XUMM integration
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_SECRET_KEY);

// XRPL client setup
const xrplClient = new xrpl.Client('wss://s.altnet.rippletest.net:51233'); // Or the appropriate XRPL network URL
const serviceWallet = process.env.SERVICE_WALLET; // SeagullCoin wallet

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: 'SeagullCoin NFT Minting API',
      version: '1.0.0',
      description: 'API for minting and managing SeagullCoin NFTs',
    },
    basePath: '/',
  },
  apis: ['./server.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /mint:
 *   post:
 *     summary: "Mint a new NFT with SeagullCoin only"
 *     description: "Mints a new SeagullCoin-only NFT after checking the SeagullCoin payment"
 *     tags: [Minting]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: "The wallet address submitting the minting request"
 *               fileURL:
 *                 type: string
 *                 description: "The URL of the file to be used as the NFT"
 *               collection:
 *                 type: string
 *                 description: "The collection the NFT belongs to"
 *     responses:
 *       200:
 *         description: "NFT minted successfully"
 *       400:
 *         description: "Bad Request - Payment validation failed"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/mint', async (req, res) => {
  const { wallet, fileURL, collection } = req.body;

  if (!wallet || !fileURL || !collection) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await xrplClient.connect();
    
    // Verify SeagullCoin payment (0.5 SeagullCoin)
    const isPaymentValid = await validateSeagullCoinPayment(wallet);
    if (!isPaymentValid) {
      return res.status(400).json({ error: 'Invalid payment. Ensure you have 0.5 SeagullCoin for minting' });
    }

    // Prepare the NFT metadata
    const metadata = {
      name: `NFT ${Date.now()}`,
      description: 'A SeagullCoin NFT',
      fileURL: fileURL,
      collection: collection,
      issuer: serviceWallet,
      currency: 'SeagullCoin',
    };

    // Mint the NFT (Example of how to mint, adapt according to your logic)
    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      URI: fileURL, // Ensure file URL is a valid IPFS or storage URL
      NFTokenTaxon: 1, // Optional, define taxon for the collection
    };

    const preparedTx = await xrplClient.autofill(mintTx);
    const signedTx = wallet.sign(preparedTx);
    const result = await xrplClient.submit(signedTx.tx_blob);

    res.status(200).json({
      message: 'NFT minted successfully',
      mintTransaction: result,
    });
  } catch (error) {
    console.error('Minting error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await xrplClient.disconnect();
  }
});

/**
 * @swagger
 * /buy-nft:
 *   post:
 *     summary: "Buy an NFT with SeagullCoin"
 *     description: "Enables purchasing an NFT with SeagullCoin."
 *     tags: [Buying]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nftID:
 *                 type: string
 *                 description: "NFT ID to be bought"
 *               buyerWallet:
 *                 type: string
 *                 description: "Wallet address of the buyer"
 *               price:
 *                 type: number
 *                 description: "Price in SeagullCoin"
 *     responses:
 *       200:
 *         description: "NFT purchased successfully"
 *       400:
 *         description: "Bad Request - Invalid payment or transaction"
 *       500:
 *         description: "Internal Server Error"
 */
app.post('/buy-nft', async (req, res) => {
  const { nftID, buyerWallet, price } = req.body;

  if (!nftID || !buyerWallet || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Verify SeagullCoin payment before proceeding with purchase
    const isPaymentValid = await validateSeagullCoinPayment(buyerWallet, price);
    if (!isPaymentValid) {
      return res.status(400).json({ error: 'Invalid payment. Ensure sufficient SeagullCoin for purchase' });
    }

    // Proceed with NFT transfer (Assuming NFT transfer logic)
    const transferTx = {
      TransactionType: 'NFTokenTransfer',
      Account: buyerWallet,
      NFTokenID: nftID,
      Destination: buyerWallet,
    };

    const preparedTx = await xrplClient.autofill(transferTx);
    const signedTx = buyerWallet.sign(preparedTx);
    const result = await xrplClient.submit(signedTx.tx_blob);

    res.status(200).json({
      message: 'NFT purchased successfully',
      transferTransaction: result,
    });
  } catch (error) {
    console.error('Error in purchasing NFT:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    await xrplClient.disconnect();
  }
});

// Helper function to validate SeagullCoin payment (just checks for sufficient balance)
async function validateSeagullCoinPayment(wallet, amount = 0.5) {
  const accountInfo = await xrplClient.request({
    command: 'account_info',
    account: wallet,
  });

  // Check if wallet has enough SeagullCoin (0.5 SeagullCoin)
  const balance = accountInfo.result.account_data.Balance / 1000000; // Convert drops to XRPC
  return balance >= amount;
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
