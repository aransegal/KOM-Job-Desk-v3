import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import { LayoutDashboard, Briefcase, CalendarDays, HardHat, Users, Calendar, LogOut, X } from 'lucide-react';

const ADMIN_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/schedule', label: 'Schedule', icon: CalendarDays },
  { path: '/vendors', label: 'Vendors', icon: HardHat },
  { path: '/customers', label: 'Customers', icon: Users },
];

const VENDOR_NAV = [
  { path: '/vendor-portal', label: 'My Schedule', icon: Calendar },
  { path: '/jobs', label: 'My Jobs', icon: Briefcase },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const role = user?.role || 'vendor';
  const navItems = (role === 'admin' || role === 'manager') ? ADMIN_NAV : VENDOR_NAV;

  return (
    <div className="h-full flex flex-col bg-white border-r border-border">
      {/* Logo area */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <img
          src="https://media.base44.com/images/public/user_69979ae63826daa68837a1ce/c695ce0a1_logo53.png"
          alt="KOM Job Desk"
          className="h-10 w-auto object-contain"
        />
        <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-foreground/70 hover:text-foreground hover:bg-secondary'
              }`}
              style={isActive ? { background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' } : {}}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #3CB371 0%, #1AA260 100%)' }}>
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors w-full px-1"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}