// getBalanceForCurrency.js

import { Client } from 'xrpl'; // XRPL Client for network requests

const SEAGULL_COIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";
const SEAGULL_COIN_CODE = "SeagullCoin"; // SeagullCoin currency code

const client = new Client('wss://s2.ripple.com'); // Or use another endpoint if necessary

// Function to fetch SeagullCoin balance for a given wallet address
export async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await client.connect(); // Connect to the network

    const accountInfo = await client.request({
      command: 'account_info',
      account: walletAddress,
      ledger_index: 'validated',
      strict: true
    });

    const trustlines = accountInfo.result.account_data.Lines;
    const seagullCoinTrustline = trustlines.find(line => 
      line.currency === SEAGULL_COIN_CODE && line.issuer === SEAGULL_COIN_ISSUER
    );

    if (seagullCoinTrustline) {
      return parseFloat(seagullCoinTrustline.balance); // Return balance
    } else {
      return 0; // If no trustline exists, return 0
    }
  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error);
    throw new Error('Failed to fetch SeagullCoin balance');
  } finally {
    await client.disconnect();
  }
}
