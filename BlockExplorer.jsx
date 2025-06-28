import React, { useEffect, useState } from 'react';

const BlockExplorer = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterAddress, setFilterAddress] = useState('');
  const [balances, setBalances] = useState({});
  const [selectedWallet, setSelectedWallet] = useState(null);

  
  useEffect(() => {
    fetch('https://seagullcoin-dex-uaj3x.ondigitalocean.app/api/blocks')
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setBlocks(data);
        setLoading(false);
        calculateBalances(data);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

    // Calculate balances from blocks data
  const calculateBalances = (blocks) => {
    const bal = {};

    blocks.forEach((block) => {
      block.transactions.forEach((tx) => {
        if (tx.from && tx.from !== 'null') {
          bal[tx.from] = (bal[tx.from] || 0) - tx.amount;
        }
        if (tx.to) {
          bal[tx.to] = (bal[tx.to] || 0) + tx.amount;
        }
      });
    });

    setBalances(bal);
   };
  
  if (loading) return <div>Loading blocks...</div>;
  if (error) return <div>Error loading blocks: {error}</div>;

  // Helper: check if chain is valid
  const isChainValid = (blocks) => {
    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i].previousHash !== blocks[i - 1].hash) {
        return false;
      }
    }
    return true;
  };

return (
  <div style={{ fontFamily: 'sans-serif' }}>
    <h1>SGLCN-X20 📦 Block Explorer</h1>

    {!selectedWallet ? (
      <>
        <div style={{ margin: '1rem 0' }}>
          <input
            type="text"
            placeholder="🔍 Search by wallet address..."
            value={filterAddress}
            onChange={(e) => setFilterAddress(e.target.value.trim())}
            style={{
              padding: '0.5rem',
              fontSize: '1rem',
              width: '100%',
              maxWidth: '400px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <h2>Balances</h2>
        <ul>
          {Object.entries(balances)
            .filter(([address]) =>
              filterAddress ? address.toLowerCase().includes(filterAddress.toLowerCase()) : true
            )
            .sort(([, a], [, b]) => b - a)
            .map(([address, balance]) => (
              <li key={address}>
                <button
                  onClick={() => setSelectedWallet(address)}
                  style={{ border: 'none', background: 'none', color: '#007bff', cursor: 'pointer' }}
                >
                  <strong>{address}</strong>
                </button>
                : {balance.toLocaleString()} XSDB
              </li>
            ))}
          {Object.keys(balances).length === 0 && <li>No balances found</li>}
        </ul>

        {!isChainValid(blocks) && (
          <div style={{ color: 'red', fontWeight: 'bold' }}>
            ⚠️ Blockchain is invalid! Broken hash chain detected.
          </div>
        )}

        {blocks.map((block, i) => {
          const isValidLink = i === 0 || block.previousHash === blocks[i - 1].hash;
          const filteredTransactions = block.transactions.filter((tx) => {
            if (!filterAddress) return true;
            return (
              tx.from?.toLowerCase() === filterAddress.toLowerCase() ||
              tx.to?.toLowerCase() === filterAddress.toLowerCase()
            );
          });

          return (
            <div
              key={block._id}
              style={{
                border: '2px solid',
                borderColor: isValidLink ? '#4caf50' : '#f44336',
                margin: '1rem 0',
                padding: '1rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
              }}
            >
              <p><strong>Index:</strong> {block.index}</p>
              <p><strong>Timestamp:</strong> {new Date(block.timestamp).toLocaleString()}</p>
              <p><strong>Hash:</strong> {block.hash}</p>
              <p><strong>Previous Hash:</strong> {block.previousHash}</p>
              <p><strong>Finalized:</strong> {block.finalized ? '✅ Yes' : '⏳ No'}</p>
              <p><strong>Transactions:</strong></p>
              <ul>
                {filteredTransactions.length === 0 && <li>None</li>}
                {filteredTransactions.map((tx, idx) => (
                  <li key={idx}>
                    From: <strong>{tx.from === 'null' ? '🚀 GENESIS' : tx.from}</strong> → To: <strong>{tx.to}</strong> — Amount: <strong>{tx.amount}</strong>
                  </li>
                ))}
              </ul>
              {!isValidLink && (
                <p style={{ color: 'red' }}>
                  ⚠️ Broken hash link! This block's <code>previousHash</code> does not match the previous block's hash.
                </p>
              )}
            </div>
          );
        })}
      </>
    ) : (
      <div>
        <button onClick={() => setSelectedWallet(null)} style={{ marginBottom: '1rem' }}>
          ← Back to explorer
        </button>
        <h2>Wallet: <code>{selectedWallet}</code></h2>
        <p><strong>Balance:</strong> {balances[selectedWallet]?.toLocaleString() ?? 0} XSDB</p>
        <h3>Transactions</h3>
          <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
  {blocks.flatMap((block) =>
    block.transactions
      .filter(tx => tx.from === selectedWallet || tx.to === selectedWallet)
      .map((tx, i) => (
        <li key={i} style={{ marginBottom: '0.75rem' }}>
          <div>
            <strong style={{ color: tx.from === selectedWallet ? 'red' : 'green' }}>
              {tx.from === selectedWallet ? 'Sent' : 'Received'}:
            </strong>{' '}
            {tx.amount.toLocaleString()} <strong>XSDB 🪙</strong>
          </div>
          <div>
            {tx.from === 'null' ? '🚀 GENESIS' : `From: ${tx.from}`} | To: {tx.to}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            Block #{block.index} • {new Date(block.timestamp).toLocaleString()}
          </div>
        </li>
      ))
  )}
</ul>
