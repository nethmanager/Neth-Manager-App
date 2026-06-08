import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2,
  CheckSquare, 
  Briefcase, 
  Globe, 
  Mail, 
  Settings, 
  Zap,
  LogOut,
  Calendar,
  Wallet,
  Bot,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';

interface SidebarItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

function SidebarItem({ to, icon: Icon, label, onClick }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group relative",
        isActive 
          ? "bg-white/10 text-white shadow-lg shadow-white/5" 
          : "text-white/40 hover:text-white/80 hover:bg-white/5"
      )}
    >
      <Icon size={18} className="transition-transform group-hover:scale-110" />
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <div className={cn(
        "absolute right-4 w-1.5 h-1.5 rounded-full bg-blue-500 transition-all duration-300",
        "opacity-0 transition-opacity",
        "group-hover:opacity-40"
      )} />
    </NavLink>
  );
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onClose) onClose();
  };

  return (
    <div className="w-full lg:w-72 h-full min-h-0 flex flex-col bg-slate-950 border-r border-white/5 relative z-50">
      <div className="p-6 lg:p-7 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tighter uppercase">Neth Manager</h1>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.3em]">Business Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 px-4 py-2 overflow-y-auto overscroll-contain space-y-1">
        <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-4 mb-4">Workspace</div>
        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" onClick={onClose} />
        <SidebarItem to="/planner" icon={Calendar} label="Daily Plan" onClick={onClose} />
        <SidebarItem to="/schedule" icon={Calendar} label="Schedule" onClick={onClose} />
        <SidebarItem to="/businesses" icon={Building2} label="Businesses" onClick={onClose} />
        <SidebarItem to="/tasks" icon={CheckSquare} label="Task List" onClick={onClose} />
        <SidebarItem to="/projects" icon={Briefcase} label="Projects" onClick={onClose} />
        <SidebarItem to="/platforms" icon={Globe} label="Platforms" onClick={onClose} />
        <SidebarItem to="/emails" icon={Mail} label="Emails" onClick={onClose} />
        <SidebarItem to="/phonebook" icon={Users} label="Phonebook" onClick={onClose} />
        <SidebarItem to="/finance" icon={Wallet} label="Finance" onClick={onClose} />
        <SidebarItem to="/assistant" icon={Bot} label="Assistant" onClick={onClose} />
        <SidebarItem to="/automations" icon={Zap} label="AI Automations" onClick={onClose} />
        
        <div className="pt-8 text-[10px] font-bold text-white/20 uppercase tracking-widest px-4 mb-4">Settings</div>
        <SidebarItem to="/settings" icon={Settings} label="Settings" onClick={onClose} />
      </nav>

      <div className="p-4 shrink-0 bg-slate-950">
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
            <Zap size={40} className="text-blue-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-xs text-white font-semibold">Everything is up to date</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
