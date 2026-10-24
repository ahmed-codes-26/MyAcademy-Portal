import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

import { AuthContext } from './auth';

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const sessionEpoch = useRef(0);
  const refreshing = useRef(null);
  const lastRefresh = useRef(0);

  const isAuthenticated = !!token && !!admin;

  const refreshSession = useCallback(async () => {
    if (refreshing.current) return refreshing.current;
    const savedToken = localStorage.getItem('token');
    if (!savedToken) return;
    const epoch = sessionEpoch.current;
    const pending = (async () => {
      const res = await api.post('/auth/refresh', {});
      // Never let an in-flight refresh undo logout or replace a newer login/password-change token.
      if (sessionEpoch.current !== epoch || localStorage.getItem('token') !== savedToken) return;
      localStorage.setItem('token', res.data.token);
      setAdmin(res.data.admin);
      setToken(res.data.token);
      lastRefresh.current = Date.now();
    })();
    refreshing.current = pending;
    try { await pending; }
    finally { if (refreshing.current === pending) refreshing.current = null; }
  }, []);

  // Returning to the portal renews the validated session for another seven days.
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        await refreshSession();
      } catch (error) {
        if (error.response?.status === 401 && !localStorage.getItem('token')) {
          setToken(null);
          setAdmin(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [refreshSession]);

  useEffect(() => {
    const renew = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh.current >= 60000) {
        refreshSession().catch(() => {}); // The shared 401 handler expires invalid sessions.
      }
    };
    const storage = (event) => {
      if (event.key === 'token' && !event.newValue) {
        sessionEpoch.current++;
        setToken(null); setAdmin(null);
      }
    };
    window.addEventListener('focus', renew);
    document.addEventListener('visibilitychange', renew);
    window.addEventListener('storage', storage);
    const interval = setInterval(renew, 60 * 60 * 1000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', renew);
      document.removeEventListener('visibilitychange', renew);
      window.removeEventListener('storage', storage);
    };
  }, [refreshSession]);

  const login = useCallback(async (identifier, password, role) => {
    sessionEpoch.current++;
    const res = await api.post('/auth/login', { identifier, password, role });
    const { token: newToken, admin: adminData } = res.data;

    localStorage.setItem('token', newToken);
    setToken(newToken);
    setAdmin(adminData);
    lastRefresh.current = Date.now();

    return adminData;
  }, []);

  const logout = useCallback(() => {
    sessionEpoch.current++;
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
