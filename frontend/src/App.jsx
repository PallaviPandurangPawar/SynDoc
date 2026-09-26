// Root React component

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DocumentProvider } from './context/DocumentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Trash from './pages/Trash';
import DocumentPage from './pages/DocumentPage';
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: '16px' }}>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <DocumentProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trash" element={<Trash />} />
            </Route>

            <Route path="/document/:id" element={<ProtectedRoute><DocumentPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </DocumentProvider>
    </AuthProvider>
  );
}

export default App;