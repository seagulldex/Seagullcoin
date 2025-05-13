// offers.js
import xrpl from "xrpl";

const SGLCN_HEX = "53656167756C6C436F696E000000000000000000";
const SGLCN_ISSUER = "rnqiA8vuNriU9pqD1ZDGFH8ajQBL25Wkno";

export async function fetchSeagullOffers(address) {
  const client = new xrpl.Client("wss://xrplcluster.com");
  await client.connect();

  try {
    const response = await client.request({
      command: "account_offers",
      account: address
    });

    const offers = response.result.offers || [];

    const filtered = offers.filter(offer => {
      const amt = offer.amount;
      return (
        typeof amt === "object" &&
        amt.currency === SGLCN_HEX &&
        amt.issuer === SGLCN_ISSUER
      );
    });

    return filtered;
  } catch (error) {
    console.error("XRPL Offer Fetch Error:", error);
    return [];
  } finally {
    await client.disconnect();
  }
}
