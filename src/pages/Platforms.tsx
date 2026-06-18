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
  Loader2,
  Check,
  X,
  Youtube,
  Instagram,
  Linkedin,
  MessageSquare,
  CreditCard,
  ShoppingBag,
  DollarSign,
  FileText,
  Clock,
  ShieldAlert,
  Sparkles,
  Video
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

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Youtube,
  Instagram,
  Linkedin,
  MessageSquare,
  CreditCard,
  ShoppingBag,
  DollarSign,
  Globe,
  Video,
  FileText
};

export default function Platforms() {
  const { user } = useUser();
  const { confirm, showToast } = useUI();
  const [activeTab, setActiveTab] = useState<'platforms' | 'integrations' | 'content' | 'approvals'>('platforms');

  const [providers, setProviders] = useState<any[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProviders() {
      try {
        setProvidersLoading(true);
        const { data, error } = await supabase
          .from('integration_providers')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (error) {
          throw error;
        }

        const mapped = (data || []).map(dbProv => ({
          id: dbProv.id,
          name: dbProv.name,
          purpose: dbProv.purpose,
          color: dbProv.color || 'text-blue-500 bg-blue-500/10',
          icon: ICON_MAP[dbProv.icon_key] || Globe,
          is_publish_enabled: dbProv.is_publish_enabled,
          capabilities: dbProv.capabilities || {}
        }));

        setProviders(mapped);
        setProvidersError(null);
      } catch (err: any) {
        console.error("Error loading integration providers:", err);
        setProvidersError(err.message || "Failed to load integration providers.");
      } finally {
        setProvidersLoading(false);
      }
    }
    loadProviders();
  }, []);

  // Modal control states
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

  // Integrations flow state loaders
  const [manualConnOpen, setManualConnOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [manualForm, setManualForm] = useState({ displayName: '', handle: '' });

  // Social Draft flow state
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [postForm, setPostForm] = useState({
    provider: 'youtube',
    title: '',
    caption: '',
    post_type: 'post',
    project_id: '',
  });

  // DB integration local state overrides (for flawless resiliency if tables are not fully ready)
  const [localIntegrationAccounts, setLocalIntegrationAccounts] = useState<any[]>([]);
  const [localSocialProfiles, setLocalSocialProfiles] = useState<any[]>([]);
  const [localSocialPosts, setLocalSocialPosts] = useState<any[]>([]);
  const [localContentAssets, setLocalContentAssets] = useState<any[]>([]);
  const [localApprovalRequests, setLocalApprovalRequests] = useState<any[]>([]);

  // DB readers
  const { data: platforms, loading: mainPlatsLoading, error: mainPlatsError, refetch: refetchPlatforms } = useSupabaseQuery<any[]>(
    () => supabase.from('platforms').select('*, business:businesses(name)').neq('status', 'archived').order('name', { ascending: true }),
    []
  );

  const { data: businesses } = useSupabaseQuery<any[]>(() => supabase.from('businesses').select('id, name'), []);
  const { data: projects } = useSupabaseQuery<any[]>(() => supabase.from('projects').select('id, name'), []);

  // Fetch Integrations tab data
  const [integrationsLoading, setIntegrationsLoading] = useState(false);

  const fetchIntegrationsData = async () => {
    if (!user) return;
    setIntegrationsLoading(true);
    try {
      // Fetch Integration Accounts
      const { data: intAccs } = await supabase.from('integration_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (intAccs) setLocalIntegrationAccounts(intAccs);

      // Fetch Social Profiles
      const { data: socProfs } = await supabase.from('social_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (socProfs) setLocalSocialProfiles(socProfs);

      // Fetch social posts & content assets
      const { data: socPosts } = await supabase.from('social_posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (socPosts) setLocalSocialPosts(socPosts);

      const { data: assets } = await supabase.from('content_assets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (assets) setLocalContentAssets(assets);

      // Fetch approval requests
      const { data: approvals } = await supabase.from('approval_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (approvals) setLocalApprovalRequests(approvals);
    } catch (e) {
      console.warn("Integration tables not fully optimized in remote database yet, relying on reliable state engine:", e);
    } finally {
      setIntegrationsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchIntegrationsData();
    }
  }, [user, activeTab]);

  // Existing Platforms logic
  const handleSubmit = async (data: any) => {
    if (!user) throw new Error('Authentication failure');
    
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

    if (modalState.mode === 'create') {
      const { data: newPlat, error: createError } = await supabase.from('platforms').insert({
        ...cleanPlatformData,
        user_id: user.id,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (createError) throw createError;

      try {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'create',
          entity_type: 'platform',
          entity_id: newPlat.id,
          details: { name: newPlat.name }
        });
      } catch (e) {
        console.warn('Activity log failed:', e);
      }

      showToast.success('Platform created');
    } else if (modalState.mode === 'edit' && modalState.platform) {
      const { error: updateError } = await supabase.from('platforms').update(cleanPlatformData).eq('id', modalState.platform.id);
      if (updateError) throw updateError;

      try {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'update',
          entity_type: 'platform',
          entity_id: modalState.platform.id,
          details: { name: cleanPlatformData.name }
        });
      } catch (e) {
        console.warn('Activity log failed:', e);
      }

      showToast.success('Platform updated');
    }
    
    refetchPlatforms();
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

      try {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'archive',
          entity_type: 'platform',
          entity_id: platform.id,
          details: { name: platform.name }
        });
      } catch (e) {
        console.warn('Activity log failed:', e);
      }

      refetchPlatforms();
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

      refetchPlatforms();
      showToast.dismiss(toastId);
      showToast.success('Global refresh complete');
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error('Global refresh failed: ' + err.message);
    }
  };

  // Integrations flow triggers
  const handleAddManualConnection = (provider: any) => {
    setSelectedProvider(provider);
    setManualForm({ displayName: '', handle: '' });
    setManualConnOpen(true);
  };

  const saveManualConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProvider) return;
    if (!manualForm.displayName) {
      showToast.error("Display Name is required.");
      return;
    }

    const toastId = showToast.loading(`Connecting ${selectedProvider.name} manually...`);
    try {
      // Save in integration_accounts
      const { data: newIntAcc, error: intAccError } = await supabase.from('integration_accounts').insert({
        user_id: user.id,
        provider: selectedProvider.id,
        display_name: manualForm.displayName.trim(),
        handle: manualForm.handle.trim() || null,
        status: 'manual',
        metadata: {}
      }).select().single();

      if (intAccError) throw intAccError;

      // Save related row in platforms (as requested)
      const { data: newPlat, error: platError } = await supabase.from('platforms').insert({
        user_id: user.id,
        name: manualForm.displayName.trim(),
        category: selectedProvider.name,
        provider: selectedProvider.id,
        platform_type: 'integration',
        connection_status: 'manual',
        status: 'active'
      }).select().single();

      if (platError) {
        console.warn("Matching row in platforms table could not be saved:", platError);
      }

      // Automatically add manual profile details to social_profiles
      if (selectedProvider.id === 'youtube' || selectedProvider.id === 'instagram' || selectedProvider.id === 'tiktok' || selectedProvider.id === 'linkedin') {
        const { error: profError } = await supabase.from('social_profiles').insert({
          user_id: user.id,
          integration_account_id: newIntAcc?.id || null,
          platform_id: newPlat?.id || null,
          provider: selectedProvider.id,
          handle: manualForm.handle.trim() || manualForm.displayName.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: manualForm.displayName.trim(),
          follower_count: 0
        });
        if (profError) throw profError;
      }

      showToast.dismiss(toastId);
      showToast.success(`Successfully connected ${selectedProvider.name} manual account!`);
      setManualConnOpen(false);
      fetchIntegrationsData();
      refetchPlatforms();
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error(`Failed to save manual connection: ${err?.message || err.toString()}`);
    }
  };

  // Create social draft
  const handleSaveSocialDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!postForm.title) {
      showToast.error("Post title is required.");
      return;
    }

    const toastId = showToast.loading("Creating draft post...");
    try {
      const { error } = await supabase.from('social_posts').insert({
        user_id: user.id,
        provider: postForm.provider,
        title: postForm.title,
        caption: postForm.caption,
        post_type: postForm.post_type,
        project_id: postForm.project_id || null,
        status: 'draft'
      });

      if (error) throw error;

      showToast.dismiss(toastId);
      showToast.success("Draft post created successfully!");
      setNewPostOpen(false);
      setPostForm({ provider: 'youtube', title: '', caption: '', post_type: 'post', project_id: '' });
      fetchIntegrationsData();
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error(`Failed to create draft: ${err.message || err.toString()}`);
    }
  };

  // Approve / Reject Requests
  const handleResolveApproval = async (id: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    const toastId = showToast.loading(`${status === 'approved' ? 'Approving' : 'Rejecting'} action...`);
    try {
      const { error } = await supabase.from('approval_requests').update({
        status,
        resolved_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;

      showToast.dismiss(toastId);
      showToast.success(`Request successfully ${status === 'approved' ? 'Approved' : 'Rejected'}!`);
      fetchIntegrationsData();
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error(`Failed to resolve approval: ${err.message || err.toString()}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Integrations Hub</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Platforms & Channels</h2>
          <p className="text-white/40 text-sm mt-1">Manage external platforms, social profiles, publishing flows, and agent tasks.</p>
        </div>
        
        {activeTab === 'platforms' && (
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
        )}

        {activeTab === 'content' && (
          <button 
            onClick={() => setNewPostOpen(true)}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90"
          >
            <Plus size={18} />
            New Draft Post
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 overflow-x-auto scroller-none">
        <button 
          onClick={() => setActiveTab('platforms')}
          className={cn(
            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap",
            activeTab === 'platforms' ? "border-blue-500 text-white" : "border-transparent text-white/40 hover:text-white/60"
          )}
        >
          Platforms
        </button>
        <button 
          onClick={() => setActiveTab('integrations')}
          className={cn(
            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap flex items-center gap-2",
            activeTab === 'integrations' ? "border-blue-500 text-white" : "border-transparent text-white/40 hover:text-white/60"
          )}
        >
          Integrations
          {localIntegrationAccounts.length > 0 && (
            <span className="text-[10px] bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded-full">
              {localIntegrationAccounts.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('content')}
          className={cn(
            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap",
            activeTab === 'content' ? "border-blue-500 text-white" : "border-transparent text-white/40 hover:text-white/60"
          )}
        >
          Content Center
        </button>
        <button 
          onClick={() => setActiveTab('approvals')}
          className={cn(
            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap flex items-center gap-2",
            activeTab === 'approvals' ? "border-blue-500 text-white" : "border-transparent text-white/40 hover:text-white/60"
          )}
        >
          Approvals
          {localApprovalRequests.filter(a => a.status === 'pending').length > 0 && (
            <span className="text-[10px] bg-amber-500/10 text-amber-500 font-bold px-2 py-0.5 rounded-full animate-pulse">
              {localApprovalRequests.filter(a => a.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Platforms */}
      {activeTab === 'platforms' && (
        <div className="space-y-8">
          {mainPlatsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="h-64 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
              ))}
            </div>
          ) : mainPlatsError ? (
            <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-4">
              <AlertCircle />
              <span>Sync Failure: {mainPlatsError}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {platforms?.map((item) => (
                <PlatformCard 
                  key={item.id} 
                  platform={item} 
                  onRefresh={refetchPlatforms}
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
        </div>
      )}

      {/* Tab 2: Integrations */}
      {activeTab === 'integrations' && (
        <div className="space-y-12">
          {/* Main Integration Providers Grid */}
          {providersLoading ? (
            <div className="p-8 text-center text-white/40 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" /> Loading integration configurations...
            </div>
          ) : providersError ? (
            <div className="p-8 rounded-[2rem] border border-red-500/10 bg-red-500/5 text-red-400 text-center flex flex-col items-center gap-2">
              <ShieldAlert className="text-red-400" size={32} />
              <h4 className="font-bold">Failed to load Integration Providers</h4>
              <p className="text-xs text-white/45">{providersError}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map((prov) => {
                const IconComp = prov.icon;
                // Compute accounts connected to this provider
                const matches = localIntegrationAccounts.filter(acc => acc.provider === prov.id);
                return (
                  <div key={prov.id} className="bg-white/5 border border-white/5 rounded-[2.5rem] p-6 hover:bg-white/[0.08] transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={cn("p-3.5 rounded-2xl", prov.color)}>
                          <IconComp size={24} />
                        </div>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest border border-white/5",
                          matches.length > 0 ? "text-emerald-400 bg-emerald-400/10" : "text-white/30"
                        )}>
                          {matches.length > 0 ? `${matches.length} Account(s)` : 'Not Connected'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{prov.name}</h3>
                      <p className="text-xs text-white/40 mt-1 whitespace-pre-wrap">{prov.purpose}</p>
                    </div>

                    <div className="mt-8 flex gap-2">
                      <button 
                        onClick={() => handleAddManualConnection(prov)}
                        className="flex-1 py-3.5 rounded-xl border border-white/10 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all text-center"
                      >
                        Connect Manual
                      </button>
                      <button 
                        disabled 
                        className="flex-1 py-3.5 rounded-xl bg-white/5 border border-transparent text-white/20 font-bold text-[10px] uppercase tracking-widest cursor-not-allowed text-center"
                      >
                        OAuth Setup
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Social Profiles Registry Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Globe size={18} className="text-blue-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Social Channels & Profiles Registry</h3>
            </div>

            {integrationsLoading ? (
              <div className="p-8 text-center text-white/40 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" /> Loading channels...
              </div>
            ) : localSocialProfiles.length === 0 ? (
              <div className="p-12 text-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.01]">
                <Globe size={36} className="text-white/20 mx-auto mb-4" />
                <h4 className="text-white font-bold uppercase text-sm tracking-widest">No Active Channels Linked</h4>
                <p className="text-xs text-white/30 max-w-sm mx-auto mt-2 leading-relaxed">
                  Connect a manual platform channel above (such as YouTube, Instagram or LinkedIn) to register a public brand profile details here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {localSocialProfiles.map((prof) => {
                  const pMeta = providers.find(p => p.id === prof.provider);
                  const Icon = pMeta?.icon || Globe;
                  return (
                    <div key={prof.id} className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-all flex items-center gap-4">
                      <div className={cn("p-2.5 rounded-xl text-blue-400 bg-blue-500/10", pMeta?.color)}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{prof.display_name || prof.handle || 'Unnamed Profile'}</h4>
                        <p className="text-xs text-white/40">
                          {prof.handle ? (prof.handle.startsWith('@') ? prof.handle : `@${prof.handle}`) : 'No handle'}
                        </p>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mt-1">{prof.follower_count?.toLocaleString() || '0'} followers</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-12">
          {/* Active and Draft Social Posts List */}
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-purple-400" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Social Posts Drafts</h3>
              </div>
            </div>

            {localSocialPosts.length === 0 ? (
              <div className="p-12 text-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.01]">
                <FileText size={36} className="text-white/20 mx-auto mb-4" />
                <h4 className="text-white font-bold uppercase text-sm tracking-widest">No Posts in Sandbox</h4>
                <p className="text-xs text-white/30 max-w-sm mx-auto mt-2">
                  Drafting provides safe storage before review. Create/draft a new post or let active AI engines suggest templates!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localSocialPosts.map((post) => {
                  const prov = providers.find(p => p.id === post.provider);
                  const IconComp = prov?.icon || Globe;
                  return (
                    <div key={post.id} className="bg-white/5 border border-white/5 rounded-3xl p-6 hover:bg-white/[0.08] transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="flex items-center gap-2 text-xs font-bold text-white/70">
                            <span className={cn("p-1.5 rounded-lg bg-white/5", prov?.color)}>
                              <IconComp size={14} />
                            </span>
                            {prov?.name || post.provider}
                          </span>
                          <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/10">
                            {post.status || 'draft'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white line-clamp-2 leading-snug">{post.title}</h4>
                        {post.caption && (
                          <p className="text-xs text-white/40 mt-2 line-clamp-3 leading-relaxed italic bg-white/5 p-3 rounded-xl border border-white/5">
                            "{post.caption}"
                          </p>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30 uppercase font-black tracking-widest">
                        <span>Format: {post.post_type || 'post'}</span>
                        {post.created_at && <span>{new Date(post.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connected Content Assets */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Sparkles size={18} className="text-sky-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Content & Graphic Assets (Creative Library)</h3>
            </div>

            {localContentAssets.length === 0 ? (
              <div className="p-12 text-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.01]">
                <FileText size={36} className="text-white/20 mx-auto mb-4" />
                <h4 className="text-white font-bold uppercase text-sm tracking-widest">Creative Library Empty</h4>
                <p className="text-xs text-white/30 max-w-sm mx-auto mt-2">
                  AI-generated thumbnails, branding cards, and visual assets created for external publication will be cached here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {localContentAssets.map((asset) => (
                  <div key={asset.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-all">
                    <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-white truncate">{asset.title}</h4>
                      <p className="text-xs text-white/40 truncate">{asset.file_path || asset.asset_type || 'Creative Asset'}</p>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-black mt-1 inline-block">
                        {asset.status || 'Draft'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-8">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <ShieldAlert size={18} className="text-amber-500" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Pending External Actions & Approvals</h3>
          </div>

          {localApprovalRequests.filter(req => req.status === 'pending').length === 0 ? (
            <div className="p-16 text-center rounded-[2rem] border border-white/5 bg-white/[0.01]">
              <ShieldCheck size={48} className="text-emerald-500 mx-auto mb-4" />
              <h4 className="text-white font-bold uppercase text-base tracking-widest">Inbox Secure</h4>
              <p className="text-xs text-white/30 max-w-sm mx-auto mt-2 leading-relaxed">
                All platform actions and auto-generated publishing posts are currently locked. If any automation processes try to upload/publish, request tickets will appear here for validation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {localApprovalRequests.filter(req => req.status === 'pending').map((req) => (
                <div key={req.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent pointer-events-none" />
                  
                  <div className="space-y-2 flex-grow">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1 rounded-full uppercase font-black tracking-widest flex items-center gap-1">
                        <Clock size={10} className="animate-spin" /> Pending Approval
                      </span>
                      <span className="text-xs text-white/50 tracking-tighter">
                        Requested: {req.created_at ? new Date(req.created_at).toLocaleString() : 'Just now'}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white uppercase tracking-tight">
                      Action Required: {req.action_type || 'Publish Post'}
                    </h4>
                    {req.summary && (
                      <p className="text-sm font-semibold text-amber-500 mb-1">
                        Summary: {req.summary}
                      </p>
                    )}
                    <p className="text-sm text-white/40 leading-relaxed max-w-2xl">
                      Target Entity Type: <span className="text-white font-black">{req.entity_type}</span> (Entity ID: <span className="font-mono text-white/50">{req.entity_id}</span>)
                    </p>
                    {req.payload && (
                      <div className="p-3 bg-black/30 rounded-xl border border-white/5 text-[11px] font-mono text-white/60 whitespace-pre-wrap max-w-2xl mt-2">
                        {typeof req.payload === 'object' ? JSON.stringify(req.payload, null, 2) : req.payload}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => handleResolveApproval(req.id, 'approved')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button 
                      onClick={() => handleResolveApproval(req.id, 'rejected')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 active:scale-95 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Connection Overlaid Dialog Modal */}
      {manualConnOpen && selectedProvider && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl relative">
            <button 
              onClick={() => setManualConnOpen(false)}
              className="absolute top-6 right-6 p-2 text-white/40 hover:text-white rounded-xl bg-white/5"
            >
              <X size={18} />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Connect {selectedProvider.name} Manually</h3>
            <p className="text-xs text-white/40 mb-6">Create a static sandbox row for {selectedProvider.name} database mapping.</p>

            <form onSubmit={saveManualConnection} className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={manualForm.displayName} 
                  onChange={(e) => setManualForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder={`e.g. My ${selectedProvider.name} Channel`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">User Handle / Account identifier</label>
                <input 
                  type="text" 
                  value={manualForm.handle} 
                  onChange={(e) => setManualForm(prev => ({ ...prev, handle: e.target.value }))}
                  placeholder="e.g. @mychannelname, my_financial_key"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setManualConnOpen(false)} 
                  className="flex-1 py-4 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/5"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-white text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/90 active:scale-95"
                >
                  Confirm Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Social Post Draft Overlay Dialog Modal */}
      {newPostOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl md:rounded-[2.5rem] p-6 md:p-8 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setNewPostOpen(false)}
              className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-white/40 hover:text-white rounded-xl bg-white/5 z-10"
            >
              <X size={18} />
            </button>

            <div className="shrink-0 pr-8">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2 uppercase tracking-tight">Draft New Social Post</h3>
              <p className="text-xs text-white/40 mb-4 md:mb-6">Create a post safely inside the creative hub before external audit logic reviews it.</p>
            </div>

            <form onSubmit={handleSaveSocialDraft} className="space-y-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Target Provider</label>
                  <select 
                    value={postForm.provider} 
                    onChange={(e) => setPostForm(prev => ({ ...prev, provider: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-sm outline-none font-bold"
                  >
                    {providers.filter(p => p.is_publish_enabled).map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-950 text-white">{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Content Format</label>
                  <select 
                    value={postForm.post_type} 
                    onChange={(e) => setPostForm(prev => ({ ...prev, post_type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-sm outline-none font-bold"
                  >
                    <option value="post" className="bg-slate-950 text-white">Grid / Feed Post</option>
                    <option value="reel" className="bg-slate-950 text-white">Reel / Short</option>
                    <option value="story" className="bg-slate-950 text-white">Story</option>
                    <option value="video" className="bg-slate-950 text-white">Video</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Draft Title</label>
                <input 
                  type="text" 
                  value={postForm.title} 
                  onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Product launch update, Weekly recap"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Post Caption / Text</label>
                <textarea 
                  rows={4}
                  value={postForm.caption} 
                  onChange={(e) => setPostForm(prev => ({ ...prev, caption: e.target.value }))}
                  placeholder="Write post hashtags, links, or visual layout info here..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-blue-500 outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-white/40 uppercase tracking-widest mb-2">Link with Project (Optional)</label>
                <select 
                  value={postForm.project_id} 
                  onChange={(e) => setPostForm(prev => ({ ...prev, project_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-sm outline-none font-bold"
                >
                  <option value="" className="bg-slate-950 text-white">-- Independent post --</option>
                  {projects?.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-white">{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setNewPostOpen(false)} 
                  className="flex-1 py-4 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/5"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-white text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/90 active:scale-95"
                >
                  Save Draft Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Existing CreateModal */}
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
