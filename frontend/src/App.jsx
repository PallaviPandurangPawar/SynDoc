// Root React component
// TODO: implement

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DocumentProvider } from './context/DocumentContext';
import Dashboard from './pages/Dashboard';
import DocumentPage from './pages/DocumentPage';

function App() {
  return (
    <DocumentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/document/:id" element={<DocumentPage />} />
        </Routes>
      </BrowserRouter>
    </DocumentProvider>
  );
}

export default App;