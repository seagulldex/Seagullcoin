import { useState } from "react";

const bridgeAssets = {
  SeagullCash: ["XRP", "XLM", "HBAR", "ALGO"],
  SeagullCoin: ["XRP", "FLR", "XDC"]
};

// Example escrow addresses you control (replace with real ones)
const escrowAddresses = {
  XRP: "rYourEscrowXRPaddress...",
  XLM: "GBYourEscrowXLMaddress...",
  HBAR: "YourEscrowHBARaddress...",
  ALGO: "YourEscrowALGOaddress...",
  FLR: "YourEscrowFLRaddress...",
  XDC: "YourEscrowXDCaddress..."
};

export default function BridgeForm() {
  const [assetType, setAssetType] = useState("SeagullCash");
  const [fromChain, setFromChain] = useState("XRP");
  const [toChain, setToChain] = useState("XLM");
  const [amount, setAmount] = useState("");
  const [receiveAddress, setReceiveAddress] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: assetType,
        fromChain,
        toChain,
        amount,
        receiveAddress
      })
    });

    const data = await res.json();
    alert(data.message || "Bridge request submitted");
  };

  const availableChains = bridgeAssets[assetType];
  const escrowAddress = escrowAddresses[fromChain];

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white shadow-xl p-6 rounded-xl mt-10 space-y-4">
      <h2 className="text-2xl font-bold text-center">Bridge Your {assetType}</h2>

      <label>
        Asset Type
        <select
          value={assetType}
          onChange={(e) => {
            const type = e.target.value;
            setAssetType(type);
            setFromChain(bridgeAssets[type][0]);
            setToChain(bridgeAssets[type][1]);
          }}
          className="w-full p-2 mt-1 border rounded"
        >
          <option value="SeagullCash">SeagullCash</option>
          <option value="SeagullCoin">SeagullCoin</option>
        </select>
      </label>

      <label>
        From Chain
        <select
          value={fromChain}
          onChange={(e) => setFromChain(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
        >
          {availableChains.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>

      {/* Show the escrow deposit address for the selected fromChain */}
      <label>
        Deposit To (Escrow Wallet)
        <input
          type="text"
          value={escrowAddress}
          readOnly
          className="w-full p-2 mt-1 border rounded bg-gray-100"
        />
      </label>

      <label>
        To Chain
        <select
          value={toChain}
          onChange={(e) => setToChain(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
        >
          {availableChains.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>

      <label>
        Your Receive Address (on {toChain})
        <input
          type="text"
          value={receiveAddress}
          onChange={(e) => setReceiveAddress(e.target.value)}
          placeholder={`Enter your ${toChain} wallet address`}
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

      <button
        className="bg-black text-white py-2 px-4 rounded w-full hover:bg-gray-800"
        type="submit"
      >
        Bridge Now
      </button>
    </form>
  );
}
