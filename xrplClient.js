// xrplClient.js
import xrpl from 'xrpl';

const client = new xrpl.Client('https://s.altnet.rippletest.net:51234/');

async function connectClient() {
  if (!client.isConnected()) {
    await client.connect();
  }
  return client;
}

export default connectClient;
