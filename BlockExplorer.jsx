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

  return (
    <div>
