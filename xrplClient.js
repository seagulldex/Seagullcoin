// xrplClient.js
import xrpl from 'xrpl';

const client = new xrpl.Client('wss://xrplcluster.com');

async function connectClient() {
  if (!client.isConnected()) {
    await client.connect();
  }
  return client;
}

export default connectClient;
