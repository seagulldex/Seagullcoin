import { Client } from 'xrpl'; // Importing 'xrpl' using ES Module syntax

const SEAGULL_COIN_ISSUER = 'rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno';
const SEAGULL_COIN_CODE = 'SGLCN-X20';

const checkSeagullCoinBalance = async (walletAddress) => {
    try {
        console.log(`Checking SeagullCoin balance for wallet: ${walletAddress}`);
        const client = new Client('wss://s.altnet.rippletest.net:51233'); // Connect to testnet
        await client.connect();

        const response = await client.request({
            command: 'account_lines',
            account: walletAddress,
            ledger_index: "validated"
        });

        const lines = response.result.lines;
        let balance = 0;

        // Find SeagullCoin balance in the response
        for (const line of lines) {
            if (line.currency === SEAGULL_COIN_CODE && line.account === SEAGULL_COIN_ISSUER) {
                balance = parseFloat(line.balance); // SeagullCoin balance
                break;
            }
        }

        await client.disconnect();

        if (balance >= 0.5) {
            console.log(`User has sufficient SeagullCoin balance: ${balance}`);
            return true;
        } else {
            console.log(`Insufficient SeagullCoin balance: ${balance}`);
            return false;
        }
    } catch (error) {
        console.error('Error checking SeagullCoin balance:', error);
        throw new Error('Error checking SeagullCoin balance');
    }
};

export default checkSeagullCoinBalance; // Export the function using ESM
