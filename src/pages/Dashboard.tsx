import React from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  Clock, 
  AlertCircle, 
  Mail, 
  CheckCircle2, 
  Zap,
  Briefcase,
  ChevronRight,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import { Task } from '../types';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';

interface StatusCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  loading?: boolean;
}

function StatusCard({ label, value, icon: Icon, trend, color, loading }: StatusCardProps) {
  const colorMap = {
    blue: 'from-blue-500/20 to-indigo-500/5 border-blue-500/20 text-blue-400',
    green: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/20 to-pink-500/5 border-purple-500/20 text-purple-400',
    orange: 'from-orange-500/20 to-amber-500/5 border-orange-500/20 text-orange-400',
    red: 'from-red-500/20 to-pink-500/5 border-red-500/20 text-red-400',
  };

  return (
    <div className={cn("relative overflow-hidden p-5 rounded-3xl border bg-gradient-to-br transition-all hover:scale-[1.02]", colorMap[color])}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
          <Icon size={20} />
        </div>
        {trend && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/5">
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">{label}</h3>
        {loading ? (
          <div className="h-8 w-12 bg-white/10 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { confirm, showToast } = useUI();
  // Real Data Fetching
  const { data: tasksCount, loading: loadingTasks, refetch: refetchTasks } = useSupabaseQuery<number>(
    () => supabase.from('tasks').select('*', { count: 'exact', head: true }).not('status', 'in', '("done","cancelled")'),
    []
  );

  const { data: projectsCount, loading: loadingProjects } = useSupabaseQuery<number>(
    () => supabase.from('projects').select('*', { count: 'exact', head: true }).not('status', 'eq', 'completed'),
    []
  );

  const { data: urgentEmails, loading: loadingEmails } = useSupabaseQuery<number>(
    () => supabase.from('emails').select('*', { count: 'exact', head: true }).eq('status', 'needs_action'),
    []
  );

  const { data: warnings, loading: loadingWarnings } = useSupabaseQuery<number>(
    () => supabase.from('platforms').select('*', { count: 'exact', head: true }).eq('status', 'warning'),
    []
  );

  const { data: priorities, loading: loadingPriorities } = useSupabaseQuery<Task[]>(
    () => supabase
      .from('tasks')
      .select('*, project:projects(name)')
      .not('status', 'in', '("done","cancelled")')
      .order('priority', { ascending: false })
      .order('ai_priority_score', { ascending: false })
      .limit(3),
    []
  );

  const { data: platforms } = useSupabaseQuery<any[]>(
    () => supabase.from('platforms').select('name, status, last_checked_at').limit(4).order('last_checked_at', { ascending: false }),
    []
  );

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold text-white tracking-tight mb-2">Good morning, Neth.</h2>
          <p className="text-white/40 text-lg">Here is what needs your attention on <span className="text-white font-medium">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-sm transition-transform active:scale-95 shadow-lg shadow-white/10"
          >
            <Plus size={18} />
            Quick Task
          </button>
          <button 
            onClick={() => navigate('/planner')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <Zap size={18} />
            AI Plan
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard label="Active Tasks" value={tasksCount ?? 0} icon={CheckCircle2} trend="Live" color="blue" loading={loadingTasks} />
        <StatusCard label="Open Projects" value={projectsCount ?? 0} icon={Briefcase} color="purple" loading={loadingProjects} />
        <StatusCard label="Urgent Emails" value={urgentEmails ?? 0} icon={Mail} color="orange" loading={loadingEmails} />
        <StatusCard label="Platform Status" value={(warnings ?? 0) > 0 ? `${warnings} Warnings` : 'All Healthy'} icon={AlertCircle} color={(warnings ?? 0) > 0 ? 'red' : 'green'} loading={loadingWarnings} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tasks & Emails */}
        <div className="lg:col-span-2 space-y-8">
          {/* Priorities Section */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-orange-400" size={24} />
                <h3 className="text-xl font-bold text-white">Top 3 Priorities</h3>
              </div>
              <button className="text-xs font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors">Refine with AI</button>
            </div>
            <div className="space-y-3">
              {loadingPriorities ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-2xl" />)
              ) : priorities?.length === 0 ? (
                <div className="p-8 text-center text-white/20 uppercase tracking-widest text-xs font-black border-2 border-dashed border-white/5 rounded-2xl">
                  No active priorities found
                </div>
              ) : (
                priorities?.map((p, i) => (
                  <div key={p.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white/50 group-hover:text-blue-400 transition-colors">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-semibold mb-0.5 group-hover:text-blue-400 transition-colors">{p.title}</h4>
                        <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest">{p.project?.name || 'No Project'}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-white/20" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Mail, label: 'Summarize Emails', color: 'bg-blue-500', action: () => navigate('/emails') },
              { icon: Plus, label: 'New Project', color: 'bg-purple-500', action: () => navigate('/projects') },
              { icon: Globe, label: 'Add Platform', color: 'bg-emerald-500', action: () => navigate('/platforms') },
              { icon: CheckCircle2, label: 'Clear Done', color: 'bg-slate-700', action: async () => {
                if (!user) return;
                const isConfirmed = await confirm({
                  title: 'Clear Completed Tasks',
                  message: 'Archive all completed tasks? This action is permanent.',
                  confirmLabel: 'Clear All',
                  isDestructive: true
                });

                if (!isConfirmed) return;

                const { error } = await supabase.from('tasks').delete().eq('status', 'done').eq('user_id', user.id);
                if (error) showToast.error('Error: ' + error.message);
                else {
                  refetchTasks();
                  showToast.success('Completed tasks cleared');
                }
              }}
            ].map((action, i) => (
              <button key={i} onClick={action.action} className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                <div className={cn("p-2 rounded-xl text-white transition-transform group-hover:scale-110", action.color)}>
                  <action.icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-tighter text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: AI Summary & Statuses */}
        <div className="space-y-8">
          {/* AI Intelligence Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-white/10 p-6 backdrop-blur-xl group shadow-2xl">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/20 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <Zap className="text-blue-400" size={20} />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">AI Insights</h3>
            </div>
            <div className="space-y-4 relative z-10">
              <p className="text-sm text-white/70 leading-relaxed italic">
                {loadingTasks ? "Analyzing..." : 
                 (tasksCount ?? 0) > 10 ? 
                 "You have a heavy workload today. I recommend focusing on high-priority tasks first and delegating smaller ones." : 
                 "Workload is manageable. Great progress on your projects!"}
              </p>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">Status</span>
                </div>
                <p className="text-xs text-white/90 font-medium">{loadingWarnings ? "Checking..." : (warnings ?? 0) > 0 ? "Platform issues detected." : "All systems normal."}</p>
              </div>
            </div>
          </div>

          {/* Platforms Status */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Platform Sync</h3>
            <div className="space-y-4">
              {platforms?.map((plat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", plat.status === 'warning' ? "bg-red-500 animate-pulse" : "bg-emerald-500")} />
                    <span className="text-xs font-semibold text-white">{plat.name}</span>
                  </div>
                  <span className="text-[10px] text-white/30 uppercase font-bold">
                    {plat.last_checked_at ? new Date(plat.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </span>
                </div>
              ))}
              {(!platforms || platforms.length === 0) && (
                <p className="text-[10px] text-white/20 uppercase font-black text-center py-4">No platforms connected</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
