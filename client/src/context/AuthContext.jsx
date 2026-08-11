import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!token && !!admin;

  // Fetch admin profile on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/admin/profile');
        setAdmin(res.data);
        setToken(savedToken);
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
        setToken(null);
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (identifier, password, role) => {
    const res = await api.post('/auth/login', { identifier, password, role });
    const { token: newToken, admin: adminData } = res.data;

    localStorage.setItem('token', newToken);
    setToken(newToken);
    setAdmin(adminData);

    return adminData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    setToken(null);
    setAdmin(null);
  }, []);

  const updateAdmin = useCallback((updatedAdmin) => {
    setAdmin(updatedAdmin);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, token, loading, isAuthenticated, login, logout, updateAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
