import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Plus, 
  MapPin, 
  MoreVertical,
  ChevronRight,
  TrendingUp,
  Briefcase,
  AlertCircle,
  Edit2,
  Trash2,
  Eye,
  Archive,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Business } from '../types';
import CreateModal from '../components/CreateModal';
import { useUser } from '../hooks/useUser';
import { useUI } from '../contexts/UIContext';

interface BusinessCardProps {
  business: Business;
  onEdit: (business: Business) => void;
  onView: (business: Business) => void;
  onDelete: (business: Business) => void;
  isMenuOpen: boolean;
  setMenuOpen: (isOpen: boolean) => void;
}

function BusinessCard({ business, onEdit, onView, onDelete, isMenuOpen, setMenuOpen }: BusinessCardProps) {
  // Fetch project count for this business
  const { data: projectCount } = useSupabaseQuery<number>(
    () => supabase.from('projects').select('*', { count: 'exact', head: true }).eq('business_id', business.id).neq('status', 'completed'),
    [business.id]
  );

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
    <div className="group relative bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-white/20 transition-all hover:bg-white/[0.07] shadow-lg">
      <div className="flex justify-between items-start mb-6">
        <div className={cn(
          "p-3 rounded-2xl bg-white/5 border border-white/5",
          business.region === 'US' ? "text-blue-400" : "text-emerald-400"
        )}>
          <Building2 size={24} />
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!isMenuOpen);
            }}
            className={cn(
              "p-2 rounded-xl transition-all",
              isMenuOpen ? "bg-white/10 text-white" : "text-white/20 hover:text-white/50 hover:bg-white/5"
            )}
          >
            <MoreVertical size={18} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden backdrop-blur-xl">
              <button 
                onClick={() => { onView(business); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
              >
                <Eye size={14} className="text-blue-400" /> View Business
              </button>
              <button 
                onClick={() => { onEdit(business); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
              >
                <Edit2 size={14} className="text-amber-400" /> Edit Business
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button 
                onClick={() => { onDelete(business); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-500/5 uppercase tracking-widest transition-colors"
              >
                <Trash2 size={14} /> Archive Business
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight line-clamp-1">{business.name}</h3>
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{business.tax_id || 'unassigned id'}</p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className={cn(
            "text-white/30",
            (projectCount ?? 0) > 0 && "text-blue-400"
          )} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{projectCount ?? 0} {projectCount === 1 ? 'Active Unit' : 'Active Units'}</span>
        </div>
        <button 
          onClick={() => onView(business)}
          className="flex items-center gap-1 text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest transition-all group/btn"
        >
          View Entity <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

export default function Businesses() {
  const { user } = useUser();
  const { confirm, showToast } = useUI();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit' | 'view';
    business: Business | null;
  }>({
    isOpen: false,
    mode: 'create',
    business: null
  });
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: businesses, loading, error, refetch } = useSupabaseQuery<Business[]>(
    () => supabase.from('businesses').select('*').neq('status', 'archived').order('name', { ascending: true }),
    []
  );

  const handleSubmit = async (data: any) => {
    if (!user) throw new Error('Authentication failure');
    
    // Normalize data
    const cleanBusinessData = {
      name: data.name?.trim(),
      region: data.region || 'US',
      status: data.status || 'active',
      tax_id: data.tax_id?.trim() || null,
      incorporation_date: data.incorporation_date || null,
      website_url: data.website_url?.trim() || null,
      legal_address: data.legal_address?.trim() || null,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (!cleanBusinessData.name) {
      throw new Error('Business name is required.');
    }

    let result;
    if (modalState.mode === 'create') {
      const { data: newBus, error: createError } = await supabase.from('businesses').insert({
        ...cleanBusinessData,
        user_id: user.id,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (createError) throw createError;
      result = newBus;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'business',
        entity_id: result.id,
        details: { name: result.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Business created');
    } else if (modalState.mode === 'edit' && modalState.business) {
      const { data: updatedBus, error: updateError } = await supabase.from('businesses').update(cleanBusinessData).eq('id', modalState.business.id).select().single();
      
      if (updateError) throw updateError;
      result = updatedBus;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'business',
        entity_id: result.id,
        details: { name: result.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Business updated');
    }
    
    refetch();
  };

  const handleDelete = async (business: Business) => {
    if (!user) return;
    const isConfirmed = await confirm({
      title: 'Archive Business',
      message: `Are you sure you want to archive ${business.name}?`,
      confirmLabel: 'Archive Business',
      isDestructive: true
    });

    if (!isConfirmed) return;
    
    try {
      const { error: archiveError } = await supabase.from('businesses').update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      }).eq('id', business.id);
      
      if (archiveError) throw archiveError;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'archive',
        entity_type: 'business',
        entity_id: business.id,
        details: { name: business.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      refetch();
      showToast.success('Business archived');
    } catch (err: any) {
      showToast.error(`Archive failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Businesses</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Businesses</h2>
          <p className="text-white/40 text-sm mt-1">Manage your companies, legal details, websites, and notes.</p>
        </div>
        <button 
          onClick={() => setModalState({ isOpen: true, mode: 'create', business: null })}
          className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90 group"
        >
          <Plus size={18} />
          Add Business
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 animate-pulse rounded-[2.5rem] border border-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-4 backdrop-blur-xl">
          <div className="p-3 rounded-2xl bg-red-500/20">
            <AlertCircle />
          </div>
          <div>
            <p className="font-bold uppercase text-xs tracking-widest">System Error</p>
            <p className="text-sm opacity-70">Could not load businesses: {error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businesses?.map((b) => (
            <BusinessCard 
              key={b.id} 
              business={b} 
              onEdit={(bus) => setModalState({ isOpen: true, mode: 'edit', business: bus })}
              onView={(bus) => setModalState({ isOpen: true, mode: 'view', business: bus })}
              onDelete={handleDelete}
              isMenuOpen={openMenuId === b.id}
              setMenuOpen={(isOpen) => setOpenMenuId(isOpen ? b.id : null)}
            />
          ))}
          
          <button 
            onClick={() => setModalState({ isOpen: true, mode: 'create', business: null })}
            className="group flex flex-col items-center justify-center p-8 rounded-[2.5rem] border-2 border-dashed border-white/5 hover:border-white/10 transition-all cursor-pointer bg-white/[0.01] min-h-[250px]"
          >
            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-white/10 group-hover:text-blue-500 transition-all mb-4">
              <Plus size={28} />
            </div>
            <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] group-hover:text-white transition-colors">Add Business</span>
          </button>
        </div>
      )}

      {/* Reusable Operational Modal */}
      <CreateModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.mode === 'create' ? "Add Business" : "Edit Business"}
        onSubmit={handleSubmit}
        mode={modalState.mode}
        initialValues={modalState.business}
        fields={[
          { name: 'name', label: 'Business Name', type: 'text', placeholder: 'e.g. Acme Corp' },
          { 
            name: 'region', 
            label: 'Region', 
            type: 'select', 
            options: [
              { label: 'United States', value: 'US' },
              { label: 'Mexico', value: 'Mexico' }
            ],
            defaultValue: 'US'
          },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select', 
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Archived', value: 'archived' }
            ],
            defaultValue: 'active'
          },
          { name: 'tax_id', label: 'Tax ID', type: 'text', placeholder: 'Tax ID or Registration Number' },
          { name: 'incorporation_date', label: 'Start Date', type: 'date' },
          { name: 'website_url', label: 'Website', type: 'text', placeholder: 'https://...' },
          { name: 'legal_address', label: 'Legal Address', type: 'textarea', placeholder: 'Full legal address...' },
          { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Add any extra notes...' }
        ]}
      />
    </div>
  );
}
