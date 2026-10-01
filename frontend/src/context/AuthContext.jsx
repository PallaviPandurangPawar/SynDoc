// Tracks the logged-in user across the whole app
import { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../services/api';

const AuthContext = createContext(null);

// The profile photo is a large Base64 string, so it is NOT saved in localStorage.
// It always comes from the database (see refreshProfile below).
const saveUserLocally = (userData) => {
  const { avatarData, ...rest } = userData || {};
  try {
    localStorage.setItem('syncdoc_user', JSON.stringify(rest));
  } catch (err) {
    console.warn('Could not save user to localStorage:', err.message);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('syncdoc_token');
    localStorage.removeItem('syncdoc_user');
    setUser(null);
  };

  // Loads the latest profile (including the avatar) from the database
  const refreshProfile = async () => {
    try {
      const res = await getProfile();
      const p = res.data;
      setUser((prev) => {
        const merged = {
          ...(prev || {}),
          id: p.id,
          name: p.name,
          email: p.email,
          avatarData: p.avatarData || '',
        };
        saveUserLocally(merged);
        return merged;
      });
    } catch (err) {
      // Token is no longer valid, so log the user out
      if (err.response?.status === 401) logout();
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('syncdoc_user');
    const storedToken = localStorage.getItem('syncdoc_token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      refreshProfile(); // fetch the avatar from the database
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('syncdoc_token', token);
    saveUserLocally(userData);
    setUser(userData);
    refreshProfile(); // fetch the avatar from the database
  };

  const updateUser = (userData) => {
    saveUserLocally(userData);
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}