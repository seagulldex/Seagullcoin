// getBalanceForCurrency.js

import { Client } from 'xrpl';

const SEAGULL_COIN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno"; // SeagullCoin issuer address
const SEAGULL_COIN_CODE = "SGLCN"; // SeagullCoin currency code

const client = new Client('wss://xrplcluster.com'); // XRPL node client

// Function to fetch SeagullCoin balance for a given wallet address
export async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await client.connect(); // Connect to the XRPL network

    // Request the account lines (trustlines) for the given wallet address
    const accountLinesResponse = await client.request({
      method: 'account_lines',
      params: [{
        account: walletAddress,
      }]
    });

    // Find the trustline for SeagullCoin (currency and issuer)
    const seagullCoinLine = accountLinesResponse.result.lines.find(line => 
      line.currency === SEAGULL_COIN_CODE && line.issuer === SEAGULL_COIN_ISSUER
    );

    // If the SeagullCoin trustline exists, return its balance
    if (seagullCoinLine) {
      return parseFloat(seagullCoinLine.balance); // Return balance as a number
    } else {
      return 0; // No balance found, return 0
    }
  } catch (error) {
    console.error('Error fetching SeagullCoin balance:', error);
    throw new Error('Failed to fetch SeagullCoin balance');
  } finally {
    await client.disconnect(); // Disconnect from the XRPL node
  }
}
