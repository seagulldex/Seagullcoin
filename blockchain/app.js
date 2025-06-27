import { StateManager } from './blockchain/StateManager.js';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function connectDB() {
  await client.connect();
  console.log('Connected to MongoDB');
  return client.db('blockchainDB');
}

async function main() {
  const db = await connectDB();
  const txCollection = db.collection('transactions');

  const state = new StateManager(txCollection);

  // Seed some balances (for example)
  state.setBalance('Alice', 100);
  state.setBalance('Bob', 50);
  state.setBalance('miner', 0);

  const tx = {
    txId: 'abc123',
    from: 'Alice',
    to: 'Bob',
    amount: 10,
  };

  if (state.isValidTransaction(tx)) {
    await state.applyTransaction(tx);
    console.log('✅ Transaction applied and saved!');
  } else {
    console.log('❌ Invalid transaction');
  }

  console.log('Balances:', state.dumpState());

  await client.close();
}

main().catch(console.error);
