import { StateManager, Transaction } from '.blockchain/StateManager';  // adjust path as needed

// Create a new state manager instance
const state = new StateManager();

// Manually set some initial balances
state.setBalance('Alice', 100);
state.setBalance('Bob', 50);
state.setBalance('miner', 0);  // miner starts with zero

// Create a transaction
const tx: Transaction = {
  txId: 'abc123',
  from: 'Alice',
  to: 'Bob',
  amount: 10,
};

// Check if the transaction is valid
if (state.isValidTransaction(tx)) {
  // Apply the transaction
  state.applyTransaction(tx);
  console.log('✅ Transaction applied!');
} else {
  console.log('❌ Invalid transaction: insufficient funds or bad amount');
}

// Check balances after transaction
console.log('Balances after transaction:', state.dumpState());

