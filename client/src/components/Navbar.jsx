import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, GraduationCap } from 'lucide-react';

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-sans font-bold text-xl text-slate-900 tracking-tight">
            My<span className="text-amber-500">Academy</span>
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            id="nav-account-btn"
            onClick={() => navigate('/account')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <User className="w-4 h-4" />
            Account
          </button>
          <button
            id="nav-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
