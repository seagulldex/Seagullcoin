import xrpl from 'xrpl';
import dotenv from 'dotenv';

dotenv.config();

// SeagullCoin constants (from .env)
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const SEAGULLCOIN_CURRENCY = process.env.SEAGULLCOIN_CURRENCY;
const SEAGULLCOIN_AMOUNT = process.env.SEAGULLCOIN_AMOUNT;
const SERVICE_WALLET = process.env.SERVICE_WALLET; // This is the wallet from which minting transactions will be issued

// Connect to the XRP Ledger
async function connectXRPL() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233"); // Change to your desired XRPL network (e.g., mainnet or testnet)
  await client.connect();
  return client;
}

// Mint NFT Function
export async function mintNFT(nft_name, nft_description, nft_file, domain, properties) {
  const client = await connectXRPL();
  const wallet = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED); // Seed of the minting wallet
  
  // Create the NFT
  const nftMetadata = {
    nft_name,
    nft_description,
    nft_file,
    domain,
    properties
  };
  
  const mintTransaction = {
    "TransactionType": "NFTokenMint",
    "Account": wallet.classicAddress,
    "Issuer": SEAGULLCOIN_ISSUER,
    "Flags": 8, // 8 indicates the NFT is transferable
    "NFTokenTaxon": 0, // Taxon for grouping NFTs
    "URI": nftMetadata,
  };
  
  // Prepare and sign the transaction
  const preparedTx = await client.autofill(mintTransaction);
  const signedTx = wallet.sign(preparedTx);
  
  // Submit the transaction
  const result = await client.submit(signedTx.tx_blob);
  await client.disconnect();
  
  return result.result.meta.TransactionResult === 'tesSUCCESS' 
    ? { success: true, nftId: result.result.tx_json.NFTokenID }
    : { success: false, error: 'Minting failed' };
}

// Process NFT Offer (Buyer Offers SeagullCoin to purchase an NFT)
export async function processNFTOffer(nftId, offerAmount) {
  const client = await connectXRPL();
  const wallet = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED);
  
  // Create the offer transaction
  const offerTransaction = {
    "TransactionType": "NFTokenCreateOffer",
    "Account": wallet.classicAddress,
    "NFTokenID": nftId,
    "Amount": {
      "currency": SEAGULLCOIN_CURRENCY,
      "issuer": SEAGULLCOIN_ISSUER,
      "value": offerAmount.toString()
    },
    "Flags": 131072, // This flag indicates that the offer is valid
  };
  
  // Prepare and sign the transaction
  const preparedTx = await client.autofill(offerTransaction);
  const signedTx = wallet.sign(preparedTx);
  
  // Submit the transaction
  const result = await client.submit(signedTx.tx_blob);
  await client.disconnect();
  
  return result.result.meta.TransactionResult === 'tesSUCCESS'
    ? { success: true, offerId: result.result.tx_json.OfferSequence }
    : { success: false, error: 'Offer creation failed' };
}

// Process NFT Sale (Seller Accepts the Offer)
export async function processNFTSale(nftId, saleAmount) {
  const client = await connectXRPL();
  const wallet = xrpl.Wallet.fromSeed(process.env.SERVICE_WALLET_SEED);
  
  // Create the sale transaction
  const saleTransaction = {
    "TransactionType": "NFTokenAcceptOffer",
    "Account": wallet.classicAddress,
    "NFTokenID": nftId,
    "Amount": {
      "currency": SEAGULLCOIN_CURRENCY,
      "issuer": SEAGULLCOIN_ISSUER,
      "value": saleAmount.toString()
    },
  };
  
  // Prepare and sign the transaction
  const preparedTx = await client.autofill(saleTransaction);
  const signedTx = wallet.sign(preparedTx);
  
  // Submit the transaction
  const result = await client.submit(signedTx.tx_blob);
  await client.disconnect();
  
  return result.result.meta.TransactionResult === 'tesSUCCESS'
    ? { success: true, saleId: result.result.tx_json.OfferSequence }
    : { success: false, error: 'Sale processing failed' };
}
