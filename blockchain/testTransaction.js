import { StateManager } from './StateManager.js';

const tx = {
  txId: 'abc123',
  from: 'Alice',
  to: 'Bob',
  amount: 10.0,
};

const state = new StateManager();

// Set initial balance manually for testing
state['balances'].set('Alice', 100); // Note: Direct access to private property

if (state.isValidTransaction(tx)) {
  state.applyTransaction(tx);
  console.log('✅ Transaction applied!');
} else {
  console.log('❌ Invalid transaction');
}

console.log('📦 Balances:', state.dumpState());
