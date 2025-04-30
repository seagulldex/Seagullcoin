import xrpl from 'xrpl';

const client = new xrpl.Client('wss://xrplcluster.com');
let isConnected = false;

// Setup the disconnect handler once
client.on('disconnected', () => {
  isConnected = false;
  console.warn("XRPL client disconnected.");
});

// Retry logic for connecting to XRPL
async function connectWithRetry(retryAttempts = 5, delayMs = 1000) {
  let attempts = 0;
  while (attempts < retryAttempts) {
    try {
      if (!client.isConnected()) {
        await client.connect();
        isConnected = true;
        console.log("Connected to XRPL node.");
        return;
      }
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} to connect failed. Retrying in ${delayMs}ms...`);
      if (attempts >= retryAttempts) {
        throw new Error('Failed to connect to XRPL after multiple attempts.');
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Ensure the client is actively connected
async function ensureConnected() {
  if (!client.isConnected()) {
    await connectWithRetry();
  } else {
    try {
      await client.request({ command: "ping" });
    } catch (e) {
      console.warn("Ping failed, reconnecting XRPL client...");
      isConnected = false;
      await connectWithRetry();
    }
  }
}

// Fetch SeagullCoin balance for a given wallet address
export async function fetchSeagullCoinBalance(walletAddress) {
  try {
    await ensureConnected(); // Ensure the client is connected

    const request = {
      "method": "account_lines",
      "params": [{
        "account": walletAddress,
      }]
    };

    const response = await client.request(request);

    // Find SeagullCoin balance in the response
    const seagullCoin = response.result.lines.find(line => line.currency === "SGLCN");
    if (seagullCoin) {
      return { balance: seagullCoin.balance };
    } else {
      return { balance: 0 }; // Return 0 if no SeagullCoin found
    }
  } catch (err) {
    console.error('Error fetching SeagullCoin balance:', err.message);
    throw new Error('Failed to fetch SeagullCoin balance: ' + err.message);
  }
}

// Gracefully disconnect the XRPL client
export async function disconnectClient() {
  try {
    if (client.isConnected()) {
      await client.disconnect();
      console.log('Disconnected from XRPL node.');
    }
  } catch (err) {
    console.warn('Error during disconnect:', err.message);
  } finally {
    isConnected = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await disconnectClient();
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', async () => {
  await disconnectClient();
  setTimeout(() => process.exit(0), 500);
});

// Catch unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

// Export raw client if needed
export { client };
