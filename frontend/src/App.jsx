// Root React component

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DocumentProvider } from './context/DocumentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Trash from './pages/Trash';
import Profile from './pages/Profile';
import DocumentPage from './pages/DocumentPage';
import Login from './pages/Login';
import Register from './pages/Register';
import LandingPage from './pages/LandingPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: '16px' }}>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DocumentProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              <Route path="/document/:id" element={<ProtectedRoute><DocumentPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </DocumentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;