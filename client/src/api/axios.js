import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Do not reload/redirect if the 401 comes from the login endpoint itself
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
