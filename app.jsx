import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BlockExplorer from './BlockExplorer'; // Adjust path if needed

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/explorer" element={<BlockExplorer />} />
        <Route path="/" element={<div>🏠 Home - <a href="/explorer">Go to Block Explorer</a></div>} />
      </Routes>
    </Router>
  );
}

export default App;
