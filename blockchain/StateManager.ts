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

export class StateManager {
  private balances: Map<string, number>;

  constructor() {
    this.balances = new Map();
  }

  initializeFromBlockchain(blocks: Block[]) {
    this.balances.clear();
    for (const block of blocks) {
      this.applyBlock(block);
    }
  }

  applyBlock(block: Block) {
    for (const tx of block.transactions) {
      if (!this.isValidTransaction(tx)) {
        console.warn(`⛔ Invalid transaction skipped: ${tx.txId}`);
        continue;
      }
      this.applyTransaction(tx);
    }
  }

  applyTransaction(tx: Transaction) {
    const fromBalance = this.balances.get(tx.from) || 0;
    const toBalance = this.balances.get(tx.to) || 0;

    this.balances.set(tx.from, fromBalance - tx.amount);
    this.balances.set(tx.to, toBalance + tx.amount);
  }

  isValidTransaction(tx: Transaction): boolean {
    const fromBalance = this.balances.get(tx.from) || 0;
    return tx.amount > 0 && fromBalance >= tx.amount;
  }

  getBalance(address: string): number {
    return this.balances.get(address) || 0;
  }

  dumpState(): Record<string, number> {
    return Object.fromEntries(this.balances.entries());
  }
}
