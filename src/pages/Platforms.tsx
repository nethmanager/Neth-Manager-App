import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Plus, 
  ExternalLink, 
  Lock, 
  RefreshCw, 
  MoreVertical,
  Activity,
  ShieldCheck,
  AlertCircle,
  Edit2,
  Trash2,
  Eye,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import CreateModal from '../components/CreateModal';
import { useUI } from '../contexts/UIContext';

interface PlatformCardProps {
  platform: any;
  onRefresh: () => void;
  onEdit: (platform: any) => void;
  onView: (platform: any) => void;
  onDelete: (platform: any) => void;
  isMenuOpen: boolean;
  setMenuOpen: (isOpen: boolean) => void;
}

function PlatformCard({ platform, onRefresh, onEdit, onView, onDelete, isMenuOpen, setMenuOpen }: PlatformCardProps) {
  const [syncing, setSyncing] = useState(false);
  const { showToast } = useUI();

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      const lastChecked = new Date().toISOString();
      await supabase.from('platforms').update({ last_checked_at: lastChecked }).eq('id', platform.id);
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: platform.user_id,
        action: 'sync',
        entity_type: 'platform',
        entity_id: platform.id,
        details: { name: platform.name, timestamp: lastChecked }
      });

      onRefresh();
      showToast.success(`${platform.name} status refreshed`);
    } catch (err: any) {
      showToast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (isMenuOpen) setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.08] transition-all group shadow-xl relative">
      <div className="flex justify-between items-start mb-6">
        <div className={cn(
          "p-3 rounded-2xl bg-white/5 border border-white/5 text-blue-400 group-hover:scale-110 transition-transform",
          platform.status === 'warning' && 'text-red-400'
        )}>
          <Globe size={24} />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest border border-white/5 flex items-center gap-1.5",
            platform.status === 'active' ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10 animate-pulse"
          )}>
            <div className={cn("w-1 h-1 rounded-full", platform.status === 'active' ? "bg-emerald-400" : "bg-red-400")} />
            {platform.status || 'Active'}
          </span>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setMenuOpen(!isMenuOpen)}
              className={cn(
                "p-2 rounded-xl transition-all",
                isMenuOpen ? "bg-white/10 text-white" : "text-white/20 hover:text-white/50 hover:bg-white/5"
              )}
            >
              <MoreVertical size={16} />
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden backdrop-blur-xl">
                <button 
                  onClick={() => { onView(platform); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
                >
                  <Eye size={14} className="text-blue-400" /> View Details
                </button>
                <button 
                  onClick={() => { onEdit(platform); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
                >
                  <Edit2 size={14} className="text-amber-400" /> Edit Platform
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button 
                  onClick={() => { onDelete(platform); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-500/5 uppercase tracking-widest transition-colors"
                >
                  <Trash2 size={14} /> Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1 tracking-tight line-clamp-1">{platform.name}</h3>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{platform.category || 'General'}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => {
            if (platform.url) window.open(platform.url, '_blank');
            else showToast.error('System error: No website URL defined for this platform.');
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest"
        >
          <ExternalLink size={12} /> Open Website
        </button>
        <button 
          onClick={() => onView(platform)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest"
        >
          <Lock size={12} /> Login Notes
        </button>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-white/30" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">
            Last Checked: {platform.last_checked_at ? new Date(platform.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </span>
        </div>
        <button 
          onClick={handleSync}
          disabled={syncing}
          className={cn("p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all", syncing && "animate-spin")}
          title="Refresh Status"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Platforms() {
  const { user } = useUser();
  const { confirm, showToast } = useUI();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit' | 'view';
    platform: any | null;
  }>({
    isOpen: false,
    mode: 'create',
    platform: null
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: platforms, loading, error, refetch } = useSupabaseQuery<any[]>(
    () => supabase.from('platforms').select('*, business:businesses(name)').neq('status', 'archived').order('name', { ascending: true }),
    []
  );

  const { data: businesses } = useSupabaseQuery<any[]>(() => supabase.from('businesses').select('id, name'), []);

  const handleSubmit = async (data: any) => {
    if (!user) throw new Error('Authentication failure');
    
    // Normalize data
    const cleanPlatformData = {
      name: data.name?.trim(),
      category: data.category?.trim() || 'General',
      url: data.url?.trim() || null,
      business_id: data.business_id || null,
      status: data.status || 'active',
      login_notes: data.login_notes?.trim() || null,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (!cleanPlatformData.name) {
      throw new Error('Platform name is required.');
    }

    let result;
    if (modalState.mode === 'create') {
      const { data: newPlat, error: createError } = await supabase.from('platforms').insert({
        ...cleanPlatformData,
        user_id: user.id,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (createError) throw createError;
      result = newPlat;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'platform',
        entity_id: result.id,
        details: { name: result.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Platform created');
    } else if (modalState.mode === 'edit' && modalState.platform) {
      const { data: updatedPlat, error: updateError } = await supabase.from('platforms').update(cleanPlatformData).eq('id', modalState.platform.id).select().single();
      if (updateError) throw updateError;
      result = updatedPlat;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'platform',
        entity_id: result.id,
        details: { name: result.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Platform updated');
    }
    
    refetch();
  };

  const handleDelete = async (platform: any) => {
    if (!user) return;
    const isConfirmed = await confirm({
      title: 'Archive Platform',
      message: `Are you sure you want to archive ${platform.name}?`,
      confirmLabel: 'Archive Platform',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error: dErr } = await supabase.from('platforms').update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      }).eq('id', platform.id);
      
      if (dErr) throw dErr;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'archive',
        entity_type: 'platform',
        entity_id: platform.id,
        details: { name: platform.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      refetch();
      showToast.success('Platform archived');
    } catch (err: any) {
      showToast.error(`Critical error: ${err.message}`);
    }
  };

  const handleGlobalSync = async () => {
    if (!user) return;
    const toastId = showToast.loading('Refreshing all platforms...');
    try {
      const timestamp = new Date().toISOString();
      await supabase.from('platforms').update({ last_checked_at: timestamp }).eq('user_id', user.id);
      
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'global_sync',
        entity_type: 'platform',
        details: { timestamp }
      });

      refetch();
      showToast.dismiss(toastId);
      showToast.success('Global refresh complete');
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error('Global refresh failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Platforms</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Platforms</h2>
          <p className="text-white/40 text-sm mt-1">Manage the tools, websites, and services your businesses use.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGlobalSync}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95 shadow-xl shadow-white/5"
          >
            <RefreshCw size={18} />
            Refresh All
          </button>
          <button 
            onClick={() => setModalState({ isOpen: true, mode: 'create', platform: null })}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90"
          >
            <Plus size={18} />
            Add Platform
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-4">
          <AlertCircle />
          <span>Sync Failure: {error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {platforms?.map((item) => (
            <PlatformCard 
              key={item.id} 
              platform={item} 
              onRefresh={refetch}
              onEdit={(p) => setModalState({ isOpen: true, mode: 'edit', platform: p })}
              onView={(p) => setModalState({ isOpen: true, mode: 'view', platform: p })}
              onDelete={handleDelete}
              isMenuOpen={openMenuId === item.id}
              setMenuOpen={(io) => setOpenMenuId(io ? item.id : null)}
            />
          ))}

          <button 
            onClick={() => setModalState({ isOpen: true, mode: 'create', platform: null })}
            className="group flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed border-white/5 hover:border-white/10 transition-all cursor-pointer bg-white/[0.01] min-h-[250px]"
          >
            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-white/10 group-hover:text-blue-500 transition-all mb-4">
              <Plus size={28} />
            </div>
            <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] group-hover:text-white transition-colors">Add Platform</span>
          </button>
        </div>
      )}

      {/* Security Banner */}
      <div className="p-10 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_-20%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="p-5 rounded-3xl bg-blue-500/10 text-blue-400 relative z-10 shadow-xl shadow-blue-500/5">
          <ShieldCheck size={48} />
        </div>
        <div className="relative z-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Security Monitoring</span>
          </div>
          <h4 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Platform Security</h4>
          <p className="text-sm text-white/40 leading-relaxed max-w-2xl px-4 md:px-0">
            All connected platforms are being monitored for unauthorized access and downtime. 
            Real-time analysis is currently securing <span className="text-blue-400 font-bold">{platforms?.length || 0} platforms</span>.
          </p>
        </div>
      </div>

      <CreateModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.mode === 'create' ? "Add Platform" : "Edit Platform"}
        onSubmit={handleSubmit}
        mode={modalState.mode}
        initialValues={modalState.platform}
        fields={[
          { name: 'name', label: 'Platform Name', type: 'text', placeholder: 'e.g. AWS, Stripe, GitHub...' },
          { name: 'category', label: 'Category', type: 'text', placeholder: 'SaaS, Infrastructure, Fintech...' },
          { name: 'url', label: 'Website URL', type: 'text', placeholder: 'https://...' },
          { 
            name: 'business_id', 
            label: 'Business', 
            type: 'select', 
            options: [
              { label: 'Independent / Global', value: '' },
              ...(businesses?.map(b => ({ label: b.name, value: b.id })) || [])
            ]
          },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select', 
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Warning', value: 'warning' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Archived', value: 'archived' }
            ],
            defaultValue: 'active'
          },
          { name: 'login_notes', label: 'Login Notes', type: 'textarea', placeholder: 'General login or access info...' },
          { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'General usage notes...' },
        ]}
      />
    </div>
  );
}
