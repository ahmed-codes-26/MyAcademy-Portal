import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Mail, Lock, ArrowLeft, Loader2, User, School, ShieldCheck, GraduationCap, Send } from 'lucide-react';
import api from '../api/axios';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [role, setRole] = useState('student'); // 'student' | 'teacher' | 'admin'
  const [emailOrReg, setEmailOrReg] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(emailOrReg, password, role);
      toast.success('Welcome back!');
      if (user?.role === 'student') {
        navigate('/student/dashboard', { replace: true });
      } else if (user?.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier, message });
      toast.success('Password reset request submitted! The admin will review it.');
      setIdentifier('');
      setMessage('');
      setMode('login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Ambient decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-100 rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-50 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2.5 mb-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
              <GraduationCap className="w-7 h-7" />
            </div>
            <span className="font-sans font-bold text-3xl text-slate-900 tracking-tight">
              My<span className="text-amber-500">Academy</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'MyAcademy Portal' : 'Password Recovery'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login'
              ? 'Sign in to access your portal'
              : 'Submit a request and the admin will assist you'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="p-6 space-y-5">
              {/* Role Selection Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setRole('student'); setEmailOrReg(''); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                    role === 'student'
                      ? 'bg-white text-amber-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('teacher'); setEmailOrReg(''); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                    role === 'teacher'
                      ? 'bg-white text-amber-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  Teacher
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('admin'); setEmailOrReg(''); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                    role === 'admin'
                      ? 'bg-white text-amber-600 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </button>
              </div>

              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {role === 'student' ? 'Registration Number' : 'Email Address'}
                </label>
                <div className="relative">
                  {role === 'student' ? (
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  )}
                  <input
                    id="login-email"
                    type={role === 'student' ? 'text' : 'email'}
                    value={emailOrReg}
                    onChange={(e) => setEmailOrReg(e.target.value)}
                    required
                    placeholder={
                      role === 'student'
                        ? 'e.g. MA260906'
                        : role === 'teacher'
                        ? 'teacher@myacademy.com'
                        : 'admin@myacademy.com'
                    }
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors uppercase-placeholder"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleForgotPassword} className="p-6 space-y-5">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>

              <div>
                <label htmlFor="forgot-identifier" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Registration Number or Email
                </label>
                <input
                  id="forgot-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="e.g. MA260906 or your email"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="forgot-message" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Message <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  id="forgot-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Any additional details for the admin..."
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Reset Request
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
