import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  MoreHorizontal,
  Package,
  Activity,
  AlertCircle,
  CheckSquare,
  DollarSign,
  Mail,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Project, ProjectItem } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';

interface ProjectItemsProps {
  project: Project;
  onUpdate?: () => void;
  createSignal?: string | number;
  onActionConsumed?: () => void;
}

export default function ProjectItems({ project, onUpdate, createSignal, onActionConsumed }: ProjectItemsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(false);
  const { confirm, showToast } = useUI();

  // Handle createSignal
  React.useEffect(() => {
    if (createSignal) {
      startAdding();
      if (onActionConsumed) onActionConsumed();
    }
  }, [createSignal]);

  // Form state for manual submission (to avoid nested forms)
  const [formDataState, setFormDataState] = useState({
    name: '',
    item_type: 'general',
    status: 'active',
    priority: 'medium',
    description: '',
    sku: '',
    url: '',
    notes: '',
    metadata: ''
  });

  const { data: items, refetch } = useSupabaseQuery<ProjectItem[]>(
    () => supabase.from('project_items').select('*').eq('project_id', project.id).neq('status', 'archived').order('created_at', { ascending: false }),
    [project.id]
  );

  const startAdding = () => {
    setFormDataState({
      name: '',
      item_type: 'general',
      status: 'active',
      priority: 'medium',
      description: '',
      sku: '',
      url: '',
      notes: '',
      metadata: ''
    });
    setIsAdding(true);
  };

  const startEditing = (item: ProjectItem) => {
    setFormDataState({
      name: item.name,
      item_type: item.item_type || 'general',
      status: item.status || 'active',
      priority: item.priority || 'medium',
      description: item.description || '',
      sku: item.sku || '',
      url: item.url || '',
      notes: item.notes || '',
      metadata: typeof item.metadata === 'string' ? item.metadata : JSON.stringify(item.metadata || '', null, 2)
    });
    setEditingItem(item);
  };

  const handleSubmit = async () => {
    if (!formDataState.name) {
      showToast.error('Name is required');
      return;
    }
    setLoading(true);
    
    let metadataJson = null;
    try {
      if (formDataState.metadata) {
        metadataJson = JSON.parse(formDataState.metadata);
      }
    } catch (e) {
      showToast.error('Invalid metadata JSON');
      setLoading(false);
      return;
    }

    const cleanItemData = {
      name: formDataState.name.trim(),
      item_type: formDataState.item_type || 'general',
      status: formDataState.status || 'active',
      priority: formDataState.priority || 'medium',
      description: formDataState.description?.trim() || null,
      sku: formDataState.sku?.trim() || null,
      url: formDataState.url?.trim() || null,
      notes: formDataState.notes?.trim() || null,
      metadata: metadataJson,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('project_items').update(cleanItemData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('project_items').insert({
          ...cleanItemData,
          user_id: project.user_id,
          business_id: project.business_id,
          project_id: project.id,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
      }
      
      setIsAdding(false);
      setEditingItem(null);
      refetch();
      showToast.success('Item saved');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast.error('Error saving item: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Archive Item',
      message: 'Archive this item? It will be hidden from the active list.',
      confirmLabel: 'Archive',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('project_items').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      refetch();
      showToast.success('Item archived');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast.error('Error archiving item: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Project Items</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Manage products, features, or records for this project</p>
        </div>
        <button
          onClick={startAdding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus size={14} />
          Add Item
        </button>
      </div>

      {(isAdding || editingItem) && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Name</label>
              <input 
                value={formDataState.name} 
                onChange={e => setFormDataState({...formDataState, name: e.target.value})}
                required 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
                placeholder="Item name..." 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Type</label>
              <select 
                value={formDataState.item_type} 
                onChange={e => setFormDataState({...formDataState, item_type: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="product">Product</option>
                <option value="feature">Feature</option>
                <option value="asset">Asset</option>
                <option value="document">Document</option>
                <option value="idea">Idea</option>
                <option value="goal">Goal</option>
                <option value="person">Person</option>
                <option value="service" >Service</option>
                <option value="subscription">Subscription</option>
                <option value="property">Property</option>
                <option value="vehicle">Vehicle</option>
                <option value="health">Health</option>
                <option value="legal">Legal</option>
                <option value="finance">Finance</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Status</label>
              <select 
                value={formDataState.status} 
                onChange={e => setFormDataState({...formDataState, status: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Priority</label>
              <select 
                value={formDataState.priority} 
                onChange={e => setFormDataState({...formDataState, priority: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">SKU / ID</label>
              <input 
                value={formDataState.sku} 
                onChange={e => setFormDataState({...formDataState, sku: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
                placeholder="Reference ID..." 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">URL</label>
            <input 
              value={formDataState.url} 
              onChange={e => setFormDataState({...formDataState, url: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
              placeholder="https://..." 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Description</label>
            <textarea 
              value={formDataState.description} 
              onChange={e => setFormDataState({...formDataState, description: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none min-h-[80px]" 
              placeholder="Brief description..." 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Notes</label>
            <textarea 
              value={formDataState.notes} 
              onChange={e => setFormDataState({...formDataState, notes: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none min-h-[80px]" 
              placeholder="Internal notes..." 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Metadata (JSON)</label>
            <textarea 
              value={formDataState.metadata} 
              onChange={e => setFormDataState({...formDataState, metadata: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none min-h-[60px]" 
              placeholder='{"key": "value"}' 
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-white text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
            >
              {loading ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </button>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setEditingItem(null); }}
              className="px-6 py-3 rounded-xl border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items?.map(item => (
          <div key={item.id} className="group bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all hover:bg-white/[0.07]">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Package size={14} />
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-white uppercase tracking-tight">{item.name}</h5>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{item.item_type || 'Unknown Type'}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      item.priority === 'urgent' ? 'text-red-400' :
                      item.priority === 'high' ? 'text-orange-400' :
                      item.priority === 'medium' ? 'text-blue-400' : 'text-slate-400'
                    )}>
                      {item.priority}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-40 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEditing(item)} className="p-1.5 text-white/50 hover:text-white transition-colors">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-400/50 hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {item.description && (
              <p className="text-[10px] text-white/40 line-clamp-2 mb-3 px-1">{item.description}</p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                <Activity size={8} className="text-emerald-400" />
                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">{item.status}</span>
              </div>
              {item.url && (
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                >
                  Link <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))}

        {items?.length === 0 && !isAdding && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-20">
            <Package size={40} className="mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest">No items found</p>
          </div>
        )}
      </div>
    </div>
  );
}
