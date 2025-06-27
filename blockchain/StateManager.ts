// blockchain/StateManager.ts
type Transaction = {
  txId: string;
  from: string;
  to: string;
  amount: number;
};

type Block = {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  hash: string;
};

// blockchain/StateManager.js
export class StateManager {
  constructor() {
    this.balances = new Map();
  }

  initializeFromBlockchain(blockchain) {
    for (const block of blockchain) {
      this.applyBlock(block);
    }
  }

  applyBlock(block) {
    for (const tx of block.transactions) {
      this.applyTransaction(tx);
    }
  }

  applyTransaction(tx) {
    const fromBalance = this.balances.get(tx.from) || 0;
    if (fromBalance < tx.amount) {
      throw new Error(`Insufficient funds for ${tx.from}`);
    }
    this.balances.set(tx.from, fromBalance - tx.amount);

    const toBalance = this.balances.get(tx.to) || 0;
    this.balances.set(tx.to, toBalance + tx.amount);
  }

  isValidTransaction(tx) {
    if (typeof tx.amount !== 'number' || tx.amount <= 0) return false;
    const fromBalance = this.balances.get(tx.from) || 0;
    return fromBalance >= tx.amount;
  }
}


  getBalance(address: string): number {
    return this.balances.get(address) || 0;
  }

  dumpState(): Record<string, number> {
    return Object.fromEntries(this.balances.entries());
  }
}
