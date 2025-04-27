// xrplClient.js
import xrpl from 'xrpl';

const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');

async function connectClient() {
  if (!client.isConnected()) {
    await client.connect();
  }
  return client;
}

export default connectClient;
