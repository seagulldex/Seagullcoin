import React, { useEffect, useState } from 'react';

const BlockExplorer = () => {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    fetch('/api/blocks')
      .then((res) => res.json())
      .then(setBlocks)
      .catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Block Explorer</h1>
      {blocks.map((block) => (
        <div key={block._id} className="border p-4 rounded mb-4 shadow bg-white">
          <p><strong>Index:</strong> {block.index}</p>
          <p><strong>Timestamp:</strong> {new Date(block.timestamp).toLocaleString()}</p>
          <p><strong>Hash:</strong> {block.hash}</p>
          <p><strong>Previous Hash:</strong> {block.previousHash}</p>
          <p><strong>Transactions:</strong> {block.transactions?.length || 0}</p>
          <p><strong>Signatures:</strong> {block.signatures?.length || 0}</p>
        </div>
      ))}
    </div>
  );
};

export default BlockExplorer;
