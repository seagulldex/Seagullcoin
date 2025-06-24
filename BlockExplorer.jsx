import React, { useEffect, useState } from 'react';

const BlockExplorer = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('https://seagullcoin-dex-uaj3x.ondigitalocean.app/api/blocks')
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setBlocks(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
      {!isChainValid(blocks) && (
        <div style={{ color: 'red', fontWeight: 'bold' }}>
          ⚠️ Blockchain is invalid! Broken hash chain detected.
        </div>
      )}
      {blocks.map((block, i) => {
        const isValidLink =
          i === 0 || block.previousHash === blocks[i - 1].hash;
        return (
          <div
            key={block._id}
            style={{
              border: '2px solid',
              borderColor: isValidLink ? '#4caf50' : '#f44336', // green if valid, red if broken
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
              {block.transactions.length === 0 && <li>None</li>}
              {block.transactions.map((tx, idx) => (
                <li key={idx}>
                  From: <strong>{tx.from}</strong> → To: <strong>{tx.to}</strong> — Amount: <strong>{tx.amount}</strong>
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
    </div>
  );
};

export default BlockExplorer;
