import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { XummSdk } from 'xumm-sdk';
import { Client, AccountInfoRequest, NFTokenMint, Payment, TrustSet } from 'xrpl';
import dotenv from 'dotenv';
import nftStorage from 'nft.storage';
import { nanoid } from 'nanoid';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize XUMM SDK
const xumm = new XummSdk(process.env.XUMM_API_KEY, process.env.XUMM_SECRET_KEY);

// Initialize XRPL Client
const client = new Client(process.env.XRPL_NODE_URL);

// Initialize NFT.Storage
const { NFTStorage, File } = nftStorage;
const nftStorageClient = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('Welcome to the SeagullCoin Minting API');
});

// Mint endpoint
app.post('/mint', async (req, res) => {
  try {
    const { nftData, collectionName, description, file } = req.body;
    const wallet = req.body.wallet;  // Wallet address of the user

    // Validate the mint cost (SeagullCoin)
    const balance = await checkSeagullCoinBalance(wallet);
    if (balance < process.env.MINT_COST) {
      return res.status(400).json({ error: 'Insufficient SeagullCoin balance' });
    }

    // Verify the mint payment through XUMM
    const mintTransaction = await createXummPayload(wallet, process.env.MINT_COST, process.env.SEAGULLCOIN_CODE);
    if (!mintTransaction) {
      return res.status(500).json({ error: 'Minting payment failed' });
    }

    // Upload the NFT to NFT.Storage
    const fileUpload = new File([file], 'nft-file', { type: 'image/jpeg' });
    const metadata = await nftStorageClient.store({
      name: nftData.name,
      description: description,
      image: fileUpload,
      collection: collectionName,
      walletAddress: wallet,
    });

    // Create the SeagullCoin-only NFT mint transaction
    const mintTransactionDetails = await mintNFT(wallet, metadata.url);
    res.status(200).json(mintTransactionDetails);
  } catch (error) {
    console.error('Error during minting process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify SeagullCoin balance
async function checkSeagullCoinBalance(wallet) {
  const accountInfo = await client.request(AccountInfoRequest(wallet));
  const balance = accountInfo.result.account_data.Balance;
  return balance; // In drops (1 SeagullCoin = 1,000,000 drops)
}

// Create XUMM payload for mint payment
async function createXummPayload(wallet, amount, currency) {
  const payload = {
    transaction: {
      TransactionType: 'Payment',
      Account: wallet,
      Amount: amount * 1000000,  // Convert to drops
      Destination: process.env.SERVICE_WALLET,
      Currency: currency,
    },
  };

  try {
    const createdPayload = await xumm.payload.create(payload);
    return createdPayload;
  } catch (error) {
    console.error('Error creating XUMM payload:', error);
    return null;
  }
}

// Mint the NFT on XRPL
async function mintNFT(wallet, metadataUrl) {
  const nftMintTransaction = {
    TransactionType: 'NFTokenMint',
    Account: wallet,
    URI: metadataUrl,
    Flags: 0,
  };

  try {
    const preparedTx = await client.autofill(nftMintTransaction);
    const signedTx = await client.sign(preparedTx.tx_json, process.env.SERVICE_WALLET_SEED);
    const txResult = await client.submit(signedTx.signedTransaction);
    return { success: true, transactionHash: txResult.result.tx_json.hash };
  } catch (error) {
    console.error('Error minting NFT:', error);
    return { success: false, error: 'Error during NFT minting' };
  }
}

// Buy endpoint (Buy an NFT using SeagullCoin)
app.post('/buy', async (req, res) => {
  const { nftId, buyerWallet } = req.body;

  try {
    const nftDetails = await getNFTDetails(nftId);
    const price = nftDetails.price;

    // Verify if buyer has enough SeagullCoin
    const balance = await checkSeagullCoinBalance(buyerWallet);
    if (balance < price) {
      return res.status(400).json({ error: 'Insufficient SeagullCoin balance' });
    }

    // Initiate the transfer of the NFT
    const transferTx = await transferNFT(buyerWallet, nftDetails.owner, nftId);
    res.status(200).json({ success: true, transactionHash: transferTx.transactionHash });
  } catch (error) {
    console.error('Error during buy process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get NFT details (for buying process)
async function getNFTDetails(nftId) {
  // Fetch details of the NFT (this is just an example, you need to implement your own logic)
  return {
    price: process.env.MINT_COST,  // Just a placeholder, this should come from your database
    owner: 'nft_owner_wallet_address',
  };
}

// Transfer NFT ownership
async function transferNFT(buyerWallet, sellerWallet, nftId) {
  const transferTransaction = {
    TransactionType: 'NFTokenTransfer',
    Account: buyerWallet,
    NFTokenID: nftId,
    Destination: sellerWallet,
  };

  try {
    const preparedTx = await client.autofill(transferTransaction);
    const signedTx = await client.sign(preparedTx.tx_json, process.env.SERVICE_WALLET_SEED);
    const txResult = await client.submit(signedTx.signedTransaction);
    return { success: true, transactionHash: txResult.result.tx_json.hash };
  } catch (error) {
    console.error('Error during NFT transfer:', error);
    return { success: false, error: 'Error during NFT transfer' };
  }
}

// Listen on the designated port
app.listen(port, () => {
  console.log(`SeagullCoin Minting API running on port ${port}`);
});
