import xrpl from "xrpl";

// Load env vars
const SGLCN_HEX = process.env.SGLCN_HEX || "53656167756C6C436F696E000000000000000000";
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;

/**
 * Checks whether a wallet has a valid trustline to SeagullCoin
 * with at least 0.5 balance.
 * @param {string} address - The XRPL wallet address.
 * @returns {Promise<boolean>}
 */
export async function hasSeagullCoinTrustline(address) {
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  try {
    const { result } = await client.request({
      command: "account_lines",
      account: address
    });

    const lines = result.lines || [];

    const hasLine = lines.some(
      (l) =>
        l.currency === SGLCN_HEX &&
        l.issuer === SGLCN_ISSUER &&
        parseFloat(l.balance) >= 0.5
    );

    return hasLine;
  } catch (err) {
    console.error("Error checking trustline:", err.message || err);
    return false;
  } finally {
    await client.disconnect();
  }
}

/**
 * Retrieves the SeagullCoin balance for a specific wallet address.
 * @param {string} walletAddress - The XRPL wallet address.
 * @returns {Promise<number>} - Returns the SeagullCoin balance.
 */
export async function getSeagullCoinBalance(walletAddress) {
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  try {
    const { result } = await client.request({
      command: "account_lines",
      account: walletAddress
    });

    const line = result.lines.find(
      (l) => l.currency === SGLCN_HEX && l.issuer === SGLCN_ISSUER
    );

    return line ? parseFloat(line.balance) : 0;
  } catch (error) {
    console.error("Error fetching SeagullCoin balance:", error.message || error);
    throw new Error("Failed to fetch SeagullCoin balance.");
  } finally {
    await client.disconnect();
  }
}
