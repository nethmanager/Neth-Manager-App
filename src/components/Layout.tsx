import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AIAssistantFooter from './AIAssistantFooter';
import Auth from './Auth';
import { useUser } from '../hooks/useUser';
import { Menu, X, Zap } from 'lucide-react';

export default function Layout() {
  const { user, loading } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      {/* Desktop Sidebar (lg+) */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="w-72 h-full bg-slate-950 border-r border-white/5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="text-blue-500" size={20} />
                <span className="font-black text-white text-md uppercase">Neth Manager</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:text-white"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden h-16 bg-slate-950 border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="text-white fill-white" size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tighter uppercase leading-none mb-0.5">Neth Manager</h1>
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest leading-none">Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </header>

        <main
  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-10"
  style={{
    paddingBottom: 'calc(var(--ai-footer-height, 72px) + var(--ai-footer-expanded-height, 0px) + env(safe-area-inset-bottom, 0px) + 4rem)'
  }}
>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <AIAssistantFooter />
    </div>
  );
}
