import { useState } from "react";

export default function SwapForm() {
  const [chain, setChain] = useState("XRP");
  const [fromToken, setFromToken] = useState("SeagullCash");
  const [toToken, setToToken] = useState("XRP");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chain,
        fromToken,
        toToken,
        amount,
        walletAddress
      }),
    });

    const data = await res.json();
    alert(data.message || "Swap submitted");
  };

  const availableChains = ["XRP", "XLM", "FLR"]; // or whatever chains you support

  const tokenOptions = {
    XRP: ["SeagullCash", "SeagullCoin", "XRP"],
    XLM: ["SeagullCash", "XLM"],
    FLR: ["SeagullCoin", "FLR"],
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white shadow-xl p-6 rounded-xl mt-10 space-y-4">
      <h2 className="text-2xl font-bold text-center">Swap Tokens</h2>

      <label>
        Chain
        <select
          value={chain}
          onChange={(e) => {
            setChain(e.target.value);
            setFromToken(tokenOptions[e.target.value][0]);
            setToToken(tokenOptions[e.target.value][1]);
          }}
          className="w-full p-2 mt-1 border rounded"
        >
          {availableChains.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>
        From Token
        <select
          value={fromToken}
          onChange={(e) => setFromToken(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
        >
          {tokenOptions[chain]
            .filter(token => token !== toToken)
            .map((token) => (
              <option key={token}>{token}</option>
            ))}
        </select>
      </label>

      <label>
        To Token
        <select
          value={toToken}
          onChange={(e) => setToToken(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
        >
          {tokenOptions[chain]
            .filter(token => token !== fromToken)
            .map((token) => (
              <option key={token}>{token}</option>
            ))}
        </select>
      </label>

      <label>
        Your Wallet Address
        <input
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder={`Enter your ${chain} wallet`}
          className="w-full p-2 mt-1 border rounded"
          required
        />
      </label>

      <label>
        Amount
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
          required
        />
      </label>

      <button type="submit" className="bg-black text-white py-2 px-4 rounded w-full hover:bg-gray-800">
        Swap Now
      </button>
    </form>
  );
}
