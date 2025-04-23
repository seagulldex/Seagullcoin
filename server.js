const express = require('express');
const bodyParser = require('body-parser');
const xrpl = require('xrpl');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

const xrplClient = new xrpl.Client('wss://s1.ripple.com');
const SEAGULLCOIN_CODE = 'SGLCN-X20'; // SeagullCoin currency code
const SEAGULLCOIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno'; // SeagullCoin issuer address
const BURN_WALLET = 'rHN78EpNHLDtY6whT89WsZ6mMoTm9XPi5U'; // The wallet that burns SeagullCoin
const MINT_COST = 0.5; // Minting cost in SeagullCoin

// Handle GET requests to the root path
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the SGLCN-X20 NFT Minting API!' });
});

// Utility function to burn SeagullCoin
async function burnSeagullCoin(wallet, amount) {
  const payment = {
    TransactionType: 'Payment',
    Account: wallet,
    Destination: BURN_WALLET,
    Amount: {
      currency: SEAGULLCOIN_CODE,
      issuer: SEAGULLCOIN_ISSUER,
      value: amount.toString(),
    },
  };

  const preparedTx = await xrplClient.autofill(payment);
  const signedTx = wallet.sign(preparedTx);
  const txResult = await xrplClient.submit(signedTx.tx_blob);
  return txResult;
}

// Complete mintNFT function
async function mintNFT(wallet, nftData) {
  // Step 1: Upload NFT metadata to NFT.Storage
  const metadata = {
    name: nftData.name,
    description: nftData.description,
    image: nftData.image, // Assuming image is URL or IPFS URL
    attributes: nftData.attributes || [], // Any additional metadata like properties
    collection: nftData.collection || null, // Optional: Attach to a collection
  };

  try {
    // Upload the metadata to NFT.Storage
    const metadataRes = await fetch('https://api.nft.storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NFT_STORAGE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!metadataRes.ok) {
      throw new Error('Failed to upload metadata');
    }

    const metadataJson = await metadataRes.json();
    const ipfsUrl = `https://ipfs.io/ipfs/${metadataJson.value.cid}`; // Metadata stored on IPFS

    // Step 2: Create the mint transaction
    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: wallet,
      Flags: 0, // Ensure the NFT is transferable (change to 0 for transferable)
      TokenTaxon: 0, // For collection
      URI: ipfsUrl, // IPFS metadata URL
      Issuer: SEAGULLCOIN_ISSUER,
      NFTokenName: nftData.name,
      NFTokenDescription: nftData.description,
      NFTokenProperties: nftData.attributes, // Optional additional properties
      TransferFee: 0, // Prevent XRP royalties (set TransferFee to 0)
      TokenType: 'NFT', // Defining NFT as a token
    };

    const preparedTx = await xrplClient.autofill(mintTx);
    const signedTx = wallet.sign(preparedTx);

    // Step 3: Submit the transaction
    const txResult = await xrplClient.submit(signedTx.tx_blob);
    const nftTokenId = txResult.result.tx_json.NFTokenID; // ID of the newly minted NFT

    // Step 4: Return mint result with transaction details
    return {
      nftTokenId,
      ipfsUrl, // Return the IPFS URL for the NFT metadata
      collection: nftData.collection || 'No Collection', // Return collection if applicable
      mintTxHash: txResult.result.hash, // The transaction hash of the minting
    };
  } catch (err) {
    console.error('Error minting NFT:', err);
    throw new Error('Minting failed');
  }
}

// /mint endpoint
app.post('/mint', async (req, res) => {
  const { wallet, nftData } = req.body;
  if (!wallet || !nftData) return res.status(400).json({ success: false, error: 'Missing wallet address or NFT data' });

  try {
    await xrplClient.connect();

    // Step 1: Verify SeagullCoin payment (similar to /pay logic)
    const transactions = await xrplClient.request({
      command: 'account_tx',
      account: wallet,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 20,
    });

    const paymentTx = transactions.result.transactions.find(tx => {
      const t = tx.tx;
      return (
        t.TransactionType === 'Payment' &&
        t.Destination === BURN_WALLET &&
        t.Amount?.currency === SEAGULLCOIN_CODE &&
        t.Amount?.issuer === SEAGULLCOIN_ISSUER &&
        parseFloat(t.Amount?.value) >= parseFloat(MINT_COST)
      );
    });

    if (!paymentTx) return res.status(403).json({ success: false, error: 'Payment not found to burn wallet' });

    // Step 2: Mint NFT
    const mintResult = await mintNFT(wallet, nftData);

    // Step 3: Burn SeagullCoin (send the mint cost to burn wallet)
    const burnTx = await burnSeagullCoin(wallet, MINT_COST);

    res.status(200).json({
      success: true,
      nftTokenId: mintResult.nftTokenId,
      ipfsUrl: mintResult.ipfsUrl,
      collection: mintResult.collection,
      mintTxHash: mintResult.mintTxHash,
      burnTxHash: burnTx.result.hash,
    });

  } catch (err) {
    console.error('Minting error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    await xrplClient.disconnect();
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
