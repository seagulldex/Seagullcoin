export class StateManager {
  constructor() {
    this.balances = new Map();
    this.GAS_FEE = 0.00002; // fixed gas fee per transaction
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

  isValidTransaction(tx) {
    if (typeof tx.amount !== 'number' || tx.amount <= 0) return false;
    const fromBalance = this.balances.get(tx.from) || 0;
    return fromBalance >= (tx.amount + this.GAS_FEE);
  }

  getBalance(address) {
    return this.balances.get(address) || 0;
  }

  dumpState() {
    return Object.fromEntries(this.balances.entries());
  }

  setBalance(address, amount) {
    this.balances.set(address, amount);
  }
}
