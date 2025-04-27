import xrpl from 'xrpl';
import dotenv from 'dotenv';

dotenv.config();

// SeagullCoin constants (from .env)
const SEAGULLCOIN_ISSUER = process.env.SEAGULLCOIN_ISSUER;
const SEAGULLCOIN_CURRENCY = process.env.SEAGULLCOIN_CURRENCY;
const SEAGULLCOIN_AMOUNT = process.env.SEAGULLCOIN_AMOUNT; // 0.5 SeagullCoin
const SERVICE_WALLET = process.env.SERVICE_WALLET; // This is the wallet from which minting transactions will be issued

// Connect to the XRP Ledger
async function connectXRPL() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233"); // Change to your desired XRPL network (e.g., mainnet or testnet)
  await client.connect();
  return client;
}

// Verify SeagullCoin Payment for Minting
export async function verifySeagullCoinPayment(userAddress) {
  const client = await connectXRPL();
  
  try {
    const accountInfo = await client.request({
      command: 'account_info',
      account: userAddress,
    });

    // Check if the SeagullCoin trustline is set and check balance
    const balances = accountInfo.result.account_data.Balances;
    const seagullCoinBalance = balances.find(
      balance => balance.currency === SEAGULLCOIN_CURRENCY && balance.issuer === SEAGULLCOIN_ISSUER
    );

    if (seagullCoinBalance && parseFloat(seagullCoinBalance.value) >= SEAGULLCOIN_AMOUNT) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error("Error verifying SeagullCoin payment:", err);
    return false;
  } finally {
    client.disconnect();
  }
}

// Verify SeagullCoin Transaction for Purchases or Transfers
export async function verifySeagullCoinTransaction(userAddress, transactionAmount) {
  const client = await connectXRPL();
  
  try {
    const accountTransactions = await client.request({
      command: 'account_tx',
      account: userAddress,
      ledger_index_min: -1, // To fetch the latest transactions
      ledger_index_max: -1,
      limit: 10, // Fetch recent transactions
    });

    // Find the most recent transaction for SeagullCoin
    const transaction = accountTransactions.result.transactions.find(tx => {
      return tx.tx.TransactionType === 'Payment' && 
             tx.tx.Amount === transactionAmount && 
             tx.tx.Destination === SERVICE_WALLET && 
             tx.tx.Currency === SEAGULLCOIN_CURRENCY && 
             tx.tx.Issuer === SEAGULLCOIN_ISSUER;
    });

    if (transaction) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error("Error verifying SeagullCoin transaction:", err);
    return false;
  } finally {
    client.disconnect();
  }
}

// Mint NFT Function
export async function mintNFT(nft_name, nft_description, nft_file, domain, properties, userAddress) {
  // First, verify SeagullCoin payment
  const isPaymentVerified = await verifySeagullCoinPayment(userAddress);
  if (!isPaymentVerified) {
    return { success: false, error: 'Insufficient SeagullCoin balance for minting' };
  }

  // Proceed with minting logic
  // Here we assume the NFT creation happens on the backend (storing metadata and generating the NFT)
  const nftMetadata = {
    name: nft_name,
    description: nft_description,
    domain,
    properties: properties ? JSON.parse(properties) : {},
    file: nft_file.path,
  };

  // You can save this metadata to IPFS or a database (e.g., NFT.Storage)
  // For the sake of simplicity, we'll simulate the minting process
  const nftId = `NFT-${Date.now()}`; // Simulated NFT ID

  // In the real-world scenario, you'd call IPFS or NFT storage to store the file and get metadata.
  // This could involve uploading the file and returning the IPFS CID.

  return { success: true, nftId };
}
