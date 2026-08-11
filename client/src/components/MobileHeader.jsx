import { Menu, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileHeader() {
  const { admin } = useAuth();

  const handleToggle = () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  const initials = admin?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TR';

  return (
    <header className="sticky top-0 z-30 lg:hidden flex items-center justify-between h-14 bg-white border-b border-slate-200 px-4 shadow-sm w-full">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleToggle}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>
        <div className="p-1 bg-amber-500 text-white rounded-md">
          <GraduationCap className="w-4 h-4" />
        </div>
        <span className="font-sans font-bold text-lg text-slate-900 tracking-tight">
          My<span className="text-amber-500">Academy</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {admin?.profilePicture ? (
          <img
            src={admin.profilePicture}
            alt={admin.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
            <span className="text-[11px] font-bold text-amber-700">{initials}</span>
          </div>
        )}
      </div>
    </header>
  );
}
