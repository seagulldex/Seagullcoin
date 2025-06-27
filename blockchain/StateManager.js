export class StateManager {
  constructor() {
    this.balances = new Map();
    this.GAS_FEE = 0.00002;
  }

  initializeFromBlockchain(blockchain) {
    if (!blockchain || blockchain.length === 0) {
      throw new Error("Blockchain must start with a genesis block");
    }

    // Optionally: validate that the first block has no 'from' fields (coinbase style)
    this.applyBlock(blockchain[0]); // Genesis block — may contain mint transactions

    for (let i = 1; i < blockchain.length; i++) {
      this.applyBlock(blockchain[i]);
    }
  }

  applyTransactionToBalances(tx, balances) {
    const fromBalance = balances.get(tx.from) || 0;
    const totalCost = tx.amount + this.GAS_FEE;

    // Only enforce balance check if this isn't a genesis 'mint' (from === null or 'coinbase')
    if (tx.from && fromBalance < totalCost) {
      throw new Error(`Insufficient funds for ${tx.from}, need ${totalCost}`);
    }

    if (tx.from) {
      balances.set(tx.from, fromBalance - totalCost);
    }

    const toBalance = balances.get(tx.to) || 0;
    balances.set(tx.to, toBalance + tx.amount);

    const minerBalance = balances.get("miner") || 0;
    balances.set("miner", minerBalance + this.GAS_FEE);
  }

  applyBlock(block) {
    const tempBalances = new Map(this.balances);

    try {
      for (const tx of block.transactions) {
        this.applyTransactionToBalances(tx, tempBalances);
      }
      this.balances = tempBalances;
    } catch (err) {
      throw err;
    }
  }

  applyTransaction(tx) {
    this.applyTransactionToBalances(tx, this.balances);
  }

  isValidTransaction(tx) {
    if (typeof tx.amount !== 'number' || tx.amount <= 0) return false;
    if (!tx.from) return true; // minting transaction (e.g., in genesis)
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
