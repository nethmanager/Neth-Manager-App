import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderPlus, 
  MoreVertical, 
  CheckCircle2, 
  ChevronRight,
  Target,
  ArrowUpRight,
  Plus,
  AlertCircle,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  Briefcase,
  User,
  LayoutGrid
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Project, ProjectStatus, Priority, Business, ProjectCategory } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import { useUI } from '../contexts/UIContext';
import CreateModal from '../components/CreateModal';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onView: (project: Project) => void;
  onDelete: (project: Project) => void;
  isMenuOpen: boolean;
  setMenuOpen: (isOpen: boolean) => void;
}

function ProjectCard({ project, onEdit, onView, onDelete, isMenuOpen, setMenuOpen }: ProjectCardProps) {
  const statusColors: Record<string, string> = {
    planning: 'text-blue-400 bg-blue-400/10',
    in_progress: 'text-orange-400 bg-orange-400/10',
    on_hold: 'text-red-400 bg-red-400/10',
    completed: 'text-emerald-400 bg-emerald-400/10',
    cancelled: 'text-rose-400 bg-rose-400/10',
  };

  const { data: taskCount } = useSupabaseQuery<number>(
    () => supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', project.id).neq('status', 'done'),
    [project.id]
  );

  const { data: itemCount } = useSupabaseQuery<number>(
    () => supabase.from('project_items').select('*', { count: 'exact', head: true }).eq('project_id', project.id),
    [project.id]
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
    <div className="group relative bg-white/5 border border-white/5 rounded-[2rem] p-6 hover:border-white/20 transition-all hover:bg-white/[0.07] shadow-xl">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-blue-400">
          <Target size={22} />
        </div>
        <div className="relative" ref={menuRef}>
          <div className="flex items-center gap-2">
            {project.status === 'completed' ? (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest border border-emerald-500/20 text-emerald-400 bg-emerald-400/5">
                Completed
              </span>
            ) : (
              <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest border border-white/5", statusColors[project.status])}>
                {project.status.replace('_', ' ')}
              </span>
            )}
            <button 
              onClick={() => setMenuOpen(!isMenuOpen)}
              className={cn(
                "p-2 rounded-xl transition-all",
                isMenuOpen ? "bg-white/10 text-white" : "text-white/20 hover:text-white/50 hover:bg-white/5"
              )}
            >
              <MoreVertical size={18} />
            </button>
          </div>
          
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden backdrop-blur-xl">
              <button 
                onClick={() => { onView(project); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
              >
                <Eye size={14} className="text-blue-400" /> View Project
              </button>
              <button 
                onClick={() => { onEdit(project); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
              >
                <Edit2 size={14} className="text-amber-400" /> Edit Project
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button 
                onClick={() => { onDelete(project); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-500/5 uppercase tracking-widest transition-colors"
              >
                <Trash2 size={14} /> Cancel Project
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight line-clamp-1">{project.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{project.business?.name || 'Independent'}</span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span className={"text-[10px] font-bold uppercase tracking-widest " + (project.category === 'personal' ? 'text-emerald-400' : 'text-purple-400')}>
            {project.category || 'Standard'}
          </span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">{project.platform?.name || 'Custom'}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end mb-1">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Progress</span>
          <span className="text-[10px] font-bold text-white/60 tracking-wider">{(project as any).progress || 0}%</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div 
            className={cn("h-full bg-blue-500 rounded-full transition-all duration-1000")} 
            style={{ width: `${(project as any).progress || 0}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-white/30" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{taskCount ?? 0} Tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <Target size={14} className="text-white/30" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{itemCount ?? 0} Items</span>
          </div>
        </div>
        <button 
          onClick={() => onView(project)}
          className="flex items-center gap-1 text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest transition-colors group/btn"
        >
          View <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { confirm, showToast } = useUI();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    project: Project | null;
  }>({
    isOpen: false,
    mode: 'create',
    project: null
  });
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'business' | 'personal'>('all');

  const { data: projects, loading, error, refetch } = useSupabaseQuery<Project[]>(
    () => {
      let query = supabase.from('projects').select('*, business:businesses(name), platform:platforms(name)').order('created_at', { ascending: false });
      if (filterMode === 'business') query = query.not('business_id', 'is', null);
      if (filterMode === 'personal') query = query.is('business_id', null);
      return query;
    },
    [filterMode]
  );

  const { data: businesses } = useSupabaseQuery<Business[]>(
    () => supabase.from('businesses').select('id, name'),
    []
  );

  const { data: platforms } = useSupabaseQuery<any[]>(
    () => supabase.from('platforms').select('id, name'),
    []
  );

  const handleSubmit = async (data: any) => {
    if (!user) throw new Error('Authentication failure');
    
    // Normalize data
    const cleanProjectData = {
      name: data.name?.trim(),
      description: data.description?.trim() || null,
      category: data.category || (data.business_id ? 'business' : 'personal'),
      business_id: data.business_id || null,
      platform_id: data.platform_id || null,
      status: data.status || 'planning',
      priority: data.priority || 'medium',
      progress: data.progress ? Number(data.progress) : 0,
      budget: data.budget ? Number(data.budget) : null,
      deadline: data.deadline || null,
      next_action: data.next_action?.trim() || null,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (!cleanProjectData.name) {
      throw new Error('Project name is required.');
    }

    let result;
    if (modalState.mode === 'create') {
      const { data: newProj, error: createError } = await supabase.from('projects').insert({
        ...cleanProjectData,
        user_id: user.id,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (createError) throw createError;
      result = newProj;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'project',
        entity_id: result.id,
        details: { name: result.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Project created');
    } else if (modalState.mode === 'edit' && modalState.project) {
      const { data: updatedProj, error: updateError } = await supabase.from('projects').update(cleanProjectData).eq('id', modalState.project.id).select().single();
      if (updateError) throw updateError;
      result = updatedProj;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'project',
        entity_id: result.id,
        details: { name: result.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Project updated');
    }
    
    refetch();
  };

  const handleDelete = async (project: Project) => {
    if (!user) return;
    const isConfirmed = await confirm({
      title: 'Cancel Project',
      message: `Are you sure you want to cancel ${project.name}? This will hide it from active views.`,
      confirmLabel: 'Cancel Project',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error: dErr } = await supabase.from('projects').update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('id', project.id);
      
      if (dErr) throw dErr;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'cancel',
        entity_type: 'project',
        entity_id: project.id,
        details: { name: project.name }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      refetch();
      showToast.success('Project cancelled');
    } catch (err: any) {
      showToast.error(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em]">Projects</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Projects</h2>
          <p className="text-white/40 text-sm mt-1">Track active projects, deadlines, budgets, and next steps.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/5 rounded-2xl p-1 mr-4">
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                filterMode === 'all' ? "bg-white text-slate-950 shadow-lg" : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              <LayoutGrid size={14} /> All
            </button>
            <button
              onClick={() => setFilterMode('business')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                filterMode === 'business' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              <Briefcase size={14} /> Business
            </button>
            <button
              onClick={() => setFilterMode('personal')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                filterMode === 'personal' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-white/40 hover:text-white/60 hover:bg-white/5"
              )}
            >
              <User size={14} /> Personal
            </button>
          </div>
          <button 
            onClick={() => setModalState({ isOpen: true, mode: 'create', project: null })}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90"
          >
            <Plus size={18} />
            Add Project
          </button>
        </div>
      </div>

      {(loading && !projects) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-4">
          <AlertCircle />
          <span>Sync Failure: {error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((item) => (
            <ProjectCard 
              key={item.id} 
              project={item} 
              onEdit={(p) => setModalState({ isOpen: true, mode: 'edit', project: p })}
              onView={(p) => navigate(`/projects/${p.id}`)}
              onDelete={handleDelete}
              isMenuOpen={openMenuId === item.id}
              setMenuOpen={(io) => setOpenMenuId(io ? item.id : null)}
            />
          ))}

          <button 
            onClick={() => setModalState({ isOpen: true, mode: 'create', project: null })}
            className="group flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed border-white/5 hover:border-white/10 transition-all cursor-pointer bg-white/[0.01] min-h-[280px]"
          >
            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-white/10 group-hover:text-emerald-500 transition-all mb-4">
              <FolderPlus size={28} />
            </div>
            <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] group-hover:text-white transition-colors">Add Project</span>
          </button>
        </div>
      )}

        <CreateModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.mode === 'create' ? "Add Project" : "Edit Project"}
        onSubmit={handleSubmit}
        mode={modalState.mode}
        initialValues={modalState.project}
        fields={[
          { name: 'name', label: 'Project Name', type: 'text', placeholder: 'Project name...' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Scope and goals...' },
          { 
            name: 'category', 
            label: 'Category', 
            type: 'select', 
            options: [
              { label: 'Business', value: 'business' },
              { label: 'Personal', value: 'personal' },
              { label: 'Home', value: 'home' },
              { label: 'Health', value: 'health' },
              { label: 'Finance', value: 'finance' },
              { label: 'Legal', value: 'legal' },
              { label: 'Family', value: 'family' },
              { label: 'Learning', value: 'learning' },
              { label: 'Travel', value: 'travel' },
              { label: 'Other', value: 'other' }
            ],
            defaultValue: 'personal'
          },
          { 
            name: 'business_id', 
            label: 'Link to Business', 
            type: 'select', 
            options: [
              { label: 'Independent / Personal', value: '' },
              ...(businesses?.map(b => ({ label: b.name, value: b.id })) || [])
            ]
          },
          { 
            name: 'platform_id', 
            label: 'Platform', 
            type: 'select', 
            options: [
              { label: 'None', value: '' },
              ...(platforms?.map(p => ({ label: p.name, value: p.id })) || [])
            ]
          },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select', 
            options: [
              { label: 'Planning', value: 'planning' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'On Hold', value: 'on_hold' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' }
            ],
            defaultValue: 'planning'
          },
          { 
            name: 'priority', 
            label: 'Priority', 
            type: 'select', 
            options: [
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Urgent', value: 'urgent' }
            ],
            defaultValue: 'medium'
          },
          { name: 'progress', label: 'Progress Percentage (0-100)', type: 'number', placeholder: '0' },
          { name: 'budget', label: 'Budget ($)', type: 'number', placeholder: '0.00' },
          { name: 'deadline', label: 'Due Date', type: 'date' },
          { name: 'next_action', label: 'Next Step', type: 'text', placeholder: 'Immediate next step...' },
          { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional project data...' }
        ]}
      >
      </CreateModal>
    </div>
  );
}
