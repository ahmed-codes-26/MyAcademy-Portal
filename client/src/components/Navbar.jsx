import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut } from 'lucide-react';

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40 w-full">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-200/80 bg-white flex items-center justify-center p-0.5">
            <img
              src="/myAcademyLogo.png"
              alt="MyAcademy Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <span className="font-sans font-bold text-xl sm:text-2xl text-slate-900 tracking-tight">
            My<span className="text-amber-500">Academy</span>
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="nav-account-btn"
            onClick={() => navigate('/account')}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Account</span>
          </button>
          <button
            id="nav-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
