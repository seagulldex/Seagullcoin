import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BlockExplorer from './BlockExplorer'; // or wherever it's located

function App() {
  return (
    <Router>
      <Routes>
        {/* Add other routes here */}
        <Route path="/explorer" element={<BlockExplorer />} />
      </Routes>
    </Router>
  );
}
