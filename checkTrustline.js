import xrpl from "xrpl";

// Load env vars
const SGLCN_HEX = process.env.SGLCN_HEX || "53656167756C6C436F696E000000000000000000";
const SGLCN_ISSUER = process.env.SGLCN_ISSUER;

export async function hasSeagullCoinTrustline(address) {
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  try {
    const { result } = await client.request({
      command: "account_lines",
      account: address,
    });

    console.log("Response from XRPL account_lines command:", result); // Log the entire response

    const lines = result.lines;

    // If lines is not present or empty, it means no trustlines
    if (!lines || lines.length === 0) {
      console.log("No trustlines found for this account.");
      return false;
    }

    // Check if SeagullCoin trustline exists and has sufficient balance
    const hasLine = lines.some(
      (l) =>
        l.currency === SGLCN_HEX &&
        l.issuer === SGLCN_ISSUER &&
        parseFloat(l.balance) >= 0.5
    );

    if (!hasLine) {
      console.log("No valid SeagullCoin trustline found:", lines);
    }

    return hasLine;
  } catch (err) {
    console.error("Error checking trustline:", err);
    return false;
  } finally {
    await client.disconnect();
  }
}
