// components/BridgeForm.jsx
import { useState } from "react";

const bridgeAssets = {
  SeagullCash: ["XRP", "XLM", "HBAR", "ALGO"],
  SeagullCoin: ["XRP", "FLR", "XDC"]
};

export default function BridgeForm() {
  const [assetType, setAssetType] = useState("SeagullCash");
  const [fromChain, setFromChain] = useState("XRP");
  const [toChain, setToChain] = useState("XLM");
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetType, fromChain, toChain, amount })
    });

    const data = await res.json();
    alert(data.message || "Bridge request submitted");
  };

  const availableChains = bridgeAssets[assetType];

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white shadow-xl p-6 rounded-xl mt-10 space-y-4">
      <h2 className="text-2xl font-bold text-center">Bridge Your {assetType}</h2>

      <label>
        Asset Type
        <select value={assetType} onChange={(e) => {
          const type = e.target.value;
          setAssetType(type);
          setFromChain(bridgeAssets[type][0]);
          setToChain(bridgeAssets[type][1]);
        }} className="w-full p-2 mt-1 border rounded">
          <option value="SeagullCash">SeagullCash</option>
          <option value="SeagullCoin">SeagullCoin</option>
        </select>
      </label>

      <label>
        From Chain
        <select value={fromChain} onChange={(e) => setFromChain(e.target.value)} className="w-full p-2 mt-1 border rounded">
          {availableChains.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>

      <label>
        To Chain
        <select value={toChain} onChange={(e) => setToChain(e.target.value)} className="w-full p-2 mt-1 border rounded">
          {availableChains.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>

      <label>
        Amount
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2 mt-1 border rounded" required />
      </label>

      <button className="bg-black text-white py-2 px-4 rounded w-full hover:bg-gray-800">
        Bridge Now
      </button>
    </form>
  );
}
