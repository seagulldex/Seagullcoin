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
  private readonly GAS_FEE = 0.00002;  // fixed gas fee per transaction

  constructor() {
    this.balances = new Map();
  }

  initializeFromBlockchain(blockchain: Block[]) {
    for (const block of blockchain) {
      this.applyBlock(block);
    }
  }

  applyBlock(block: Block) {
    for (const tx of block.transactions) {
      this.applyTransaction(tx);
    }
  }

  applyTransaction(tx: Transaction) {
    const fromBalance = this.balances.get(tx.from) || 0;
    const totalCost = tx.amount + this.GAS_FEE;

    if (fromBalance < totalCost) {
      throw new Error(`Insufficient funds for ${tx.from}, need ${totalCost}`);
    }

    this.balances.set(tx.from, fromBalance - totalCost);

    const toBalance = this.balances.get(tx.to) || 0;
    this.balances.set(tx.to, toBalance + tx.amount);

    const minerAddress = "miner";
    const minerBalance = this.balances.get(minerAddress) || 0;
    this.balances.set(minerAddress, minerBalance + this.GAS_FEE);
  }

  isValidTransaction(tx: Transaction) {
    if (typeof tx.amount !== 'number' || tx.amount <= 0) return false;
    const fromBalance = this.balances.get(tx.from) || 0;
    return fromBalance >= (tx.amount + this.GAS_FEE);
  }

  getBalance(address: string): number {
    return this.balances.get(address) || 0;
  }

  dumpState(): Record<string, number> {
    return Object.fromEntries(this.balances.entries());
  }

  setBalance(address: string, amount: number) {
    this.balances.set(address, amount);
  }
}
