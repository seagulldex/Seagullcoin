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

// Mint NFT Function
export async function mintNFT(nft_name, nft_description, nft_file, domain, properties, userAddress) {
  // First, verify SeagullCoin payment
  const isPaymentVerified = await verifySeagullCoinPayment(userAddress);
  if (!isPaymentVerified) {
    return { success: false, error: 'Insufficient SeagullCoin balance for minting' };
  }

  // Proceed with minting logic
  // In this example, we assume the NFT creation happens here...
  
  return { success: true, nftId: "sample-nft-id" };
}
