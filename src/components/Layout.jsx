import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 shadow-lg lg:relative lg:shadow-none lg:translate-x-0 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center justify-center h-14 px-4 bg-white border-b border-border shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="absolute left-2">
            <Menu className="h-5 w-5" />
          </Button>
          <img
            src="https://media.base44.com/images/public/user_69979ae63826daa68837a1ce/c695ce0a1_logo53.png"
            alt="KOM Job Desk"
            className="h-32"
          />
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}