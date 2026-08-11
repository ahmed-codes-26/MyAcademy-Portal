import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, CalendarCheck, CreditCard, BarChart3, FileText, LogOut, MessageSquare, X, GraduationCap } from 'lucide-react';

export default function TeacherSidebar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('toggle-sidebar', handleToggle);
    window.addEventListener('close-sidebar', handleClose);

    return () => {
      window.removeEventListener('toggle-sidebar', handleToggle);
      window.removeEventListener('close-sidebar', handleClose);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/teacher/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/teacher/fee', label: 'Fee', icon: CreditCard },
    { to: '/teacher/stats', label: 'Attendance Stats', icon: BarChart3 },
    { to: '/teacher/notes', label: 'Notes', icon: FileText },
    { to: '/teacher/whatsapp', label: 'WhatsApp Setup', icon: MessageSquare },
  ];

  const initials = admin?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TR';

  return (
    <>
      {/* Background Overlay for mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-[260px] bg-white border-r border-slate-200 shadow-sm flex flex-col py-6 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header */}
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-sans text-xl font-bold text-slate-900 tracking-tight">
                My<span className="text-amber-500">Academy</span>
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Instructor Panel</p>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                onClick={() => setIsOpen(false)} // Close sidebar on link click (mobile)
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-50 text-amber-600 border-r-4 border-amber-500 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Profile Box */}
        <div className="px-4 mt-auto space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
            {admin?.profilePicture ? (
              <img
                src={admin.profilePicture}
                alt={admin.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
                <span className="text-sm font-bold text-amber-700">{initials}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{admin?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{admin?.batchName || 'Instructor'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
