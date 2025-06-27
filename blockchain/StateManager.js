export class StateManager {
  constructor() {
  this.balances = new Map();
  this.GAS_FEE = 0.00002;
}


  initializeFromBlockchain(blockchain) {
    for (const block of blockchain) {
      this.applyBlock(block);
    }
  }

  applyBlock(block) {
  // clone balances map
  const tempBalances = new Map(this.balances);

  try {
    for (const tx of block.transactions) {
      const fromBalance = tempBalances.get(tx.from) || 0;
      const totalCost = tx.amount + this.GAS_FEE;
      if (fromBalance < totalCost) throw new Error(`Insufficient funds for ${tx.from}`);

      tempBalances.set(tx.from, fromBalance - totalCost);
      const toBalance = tempBalances.get(tx.to) || 0;
      tempBalances.set(tx.to, toBalance + tx.amount);
      const minerBalance = tempBalances.get("miner") || 0;
      tempBalances.set("miner", minerBalance + this.GAS_FEE);
    }
    // If all passed, commit to actual balances
    this.balances = tempBalances;
  } catch (err) {
    throw err; // propagate error to caller
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
