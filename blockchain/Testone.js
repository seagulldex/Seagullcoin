import { StateManager } from './StateManager.js';  // adjust if path differs

const state = new StateManager();

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
  state.applyTransaction(tx);
  console.log('✅ Transaction applied!');
} else {
  console.log('❌ Invalid transaction: insufficient funds or bad amount');
}

console.log('Balances after transaction:', state.dumpState());
