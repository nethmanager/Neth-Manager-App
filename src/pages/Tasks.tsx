import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Zap,
  Edit2,
  Trash2,
  Eye,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Task, TaskStatus, Priority, Project, Business } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import { useAI } from '../contexts/AIContext';
import { useUI } from '../contexts/UIContext';
import CreateModal from '../components/CreateModal';

import { generateResponse } from '../lib/localAIService';

interface TaskRowProps {
  task: Task;
  onRefresh: () => void;
  aiSettings: any;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (task: Task) => void;
  isMenuOpen: boolean;
  setMenuOpen: (isOpen: boolean) => void;
  openUpwards?: boolean;
}

function TaskRow({ task, onRefresh, aiSettings, onEdit, onView, onDelete, isMenuOpen, setMenuOpen, openUpwards }: TaskRowProps) {
  const [completing, setCompleting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  
  const statusColors = {
    backlog: 'bg-slate-500/10 text-slate-400',
    today: 'bg-blue-500/10 text-blue-400',
    in_progress: 'bg-orange-500/10 text-orange-400',
    waiting: 'bg-purple-500/10 text-purple-400',
    done: 'bg-emerald-500/10 text-emerald-400',
    cancelled: 'bg-red-500/10 text-red-400',
  };

  const priorityColors = {
    low: 'text-slate-500',
    medium: 'text-blue-400',
    high: 'text-orange-400',
    urgent: 'text-red-400',
  };

  const handleToggleDone = async () => {
    if (completing) return;
    setCompleting(true);
    const newStatus = task.status === 'done' ? 'backlog' : 'done';
    const completionDate = newStatus === 'done' ? new Date().toISOString() : null;

    try {
      await supabase
        .from('tasks')
        .update({ 
          status: newStatus, 
          completed_at: completionDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);
      
      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: task.user_id,
        action: newStatus === 'done' ? 'complete' : 'reopen',
        entity_type: 'task',
        entity_id: task.id,
        details: { title: task.title }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  const suggestPriority = async () => {
    if (!aiSettings?.enabled || suggesting) return;
    setSuggesting(true);

    try {
      const prompt = `Based on the following task title and description, suggest a priority level (low, medium, high, or urgent) and a numeric priority score (1-100).
      Title: ${task.title}
      Description: ${task.description || 'No description provided.'}
      
      Response with ONLY a JSON object: {"priority": "word", "score": number}.`;

      const responseText = await generateResponse(
        aiSettings.ollama_endpoint,
        aiSettings.model_name,
        prompt,
        "You are Neth, a highly efficient AI task manager. Output valid JSON only.",
        aiSettings.temperature,
        aiSettings.max_tokens
      );

      const jsonStr = responseText.match(/\{.*\}/s)?.[0];
      if (!jsonStr) throw new Error('Invalid AI response');
      const aiData = JSON.parse(jsonStr);

      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (validPriorities.includes(aiData.priority)) {
        await supabase.from('tasks').update({ 
          priority: aiData.priority,
          ai_priority_score: aiData.score,
          updated_at: new Date().toISOString()
        }).eq('id', task.id);

        await supabase.from('activity_logs').insert({
          user_id: task.user_id,
          action: 'ai_prioritize',
          entity_type: 'task',
          entity_id: task.id,
          details: { priority: aiData.priority, score: aiData.score }
        });

        onRefresh();
      }
    } catch (error) {
      console.error('Failed to suggest priority:', error);
    } finally {
      setSuggesting(false);
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
    <div className="group flex items-center gap-4 py-4 px-6 hover:bg-white/[0.03] transition-all border-b border-white/5 last:border-0 last:rounded-b-[2.5rem] relative">
      <button 
        onClick={handleToggleDone}
        className={cn(
          "flex-shrink-0 transition-colors",
          task.status === 'done' ? "text-emerald-500" : "text-white/20 hover:text-white/40"
        )}
      >
        {task.status === 'done' ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className={cn(
            "text-sm font-semibold truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight",
            task.status === 'done' ? "text-white/30 line-through" : "text-white"
          )}>{task.title}</h4>
          <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest shrink-0", statusColors[task.status])}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={cn("sm:hidden text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest shrink-0", priorityColors[task.priority])}>
            {task.priority}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{task.business?.name || 'Personal'}</span>
          <span className="w-1 h-1 rounded-full bg-white/10" />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{task.project?.name || 'Operations'}</span>
          {(task.work_date || task.due_date) && (
  <>
    <span className="w-1 h-1 rounded-full bg-white/10" />
    <span className="text-[10px] text-white/40 font-mono tracking-tighter">
      {new Date(task.work_date || task.due_date!).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      {' • '}
      {new Date(task.work_date || task.due_date!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </span>
  </>
)}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-3">
          {aiSettings?.enabled && task.status !== 'done' && (
            <button 
              onClick={suggestPriority}
              disabled={suggesting}
              className={cn(
                "p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all opacity-0 group-hover:opacity-100",
                suggesting && "animate-pulse"
              )}
              title="AI suggest priority"
            >
              <Zap size={14} />
            </button>
          )}
          <div className="flex flex-col items-end">
            <span className={cn("text-[10px] font-black uppercase tracking-widest", priorityColors[task.priority])}>{task.priority}</span>
            <span className="text-[9px] text-white/20 uppercase font-bold">Priority</span>
          </div>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!isMenuOpen)}
            className={cn(
              "p-2 rounded-xl transition-all",
              isMenuOpen ? "bg-white/10 text-white" : "text-white/20 hover:text-white/50 hover:bg-white/5"
            )}
          >
            <MoreVertical size={18} />
          </button>
          
          {isMenuOpen && (
            <div className={cn(
              "absolute right-0 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden backdrop-blur-xl",
              openUpwards ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
            )}>
              <button 
                onClick={() => { onView(task); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
              >
                <Eye size={14} className="text-blue-400" /> View Details
              </button>
              <button 
                onClick={() => { onEdit(task); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 uppercase tracking-widest transition-colors"
              >
                <Edit2 size={14} className="text-amber-400" /> Edit Details
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button 
                onClick={() => { onDelete(task); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-500/5 uppercase tracking-widest transition-colors"
              >
                <Trash2 size={14} /> Cancel Task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const { user } = useUser();
  const { aiSettings } = useAI();
  const { confirm, showToast } = useUI();
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit' | 'view';
    task: Task | null;
  }>({
    isOpen: false,
    mode: 'create',
    task: null
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: tasks, loading, error, refetch } = useSupabaseQuery<Task[]>(
    () => supabase.from('tasks').select('*, business:businesses(name), project:projects(name)').order('created_at', { ascending: false }),
    []
  );

  const { data: businesses } = useSupabaseQuery<Business[]>(() => supabase.from('businesses').select('id, name'), []);
  const { data: projects } = useSupabaseQuery<Project[]>(() => supabase.from('projects').select('id, name'), []);
  const { data: platforms } = useSupabaseQuery<any[]>(() => supabase.from('platforms').select('id, name'), []);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      const matchFilter = filter === 'all' ? true : t.status === filter;
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.project?.name?.toLowerCase().includes(search.toLowerCase()) ||
                          t.business?.name?.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [tasks, filter, search]);

  const handleSubmit = async (data: any) => {
    if (!user) throw new Error('Authentication failure');
    
    // Parse JSON recurring_config
    let recurring_config = null;
    if (data.recurring_config && data.recurring_config.trim()) {
      try {
        recurring_config = JSON.parse(data.recurring_config);
      } catch (e) {
        showToast.error('Invalid Recurring Config JSON format');
        return;
      }
    }

    const cleanTaskData = {
      title: data.title?.trim(),
      description: data.description?.trim() || null,
      business_id: data.business_id || null,
      project_id: data.project_id || null,
      platform_id: data.platform_id || null,
      status: data.status || 'today',
      priority: data.priority || 'medium',
      due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
      work_date: data.work_date ? new Date(data.work_date).toISOString() : null,
      recurring_type: data.recurring_type || 'none',
      recurring_config,
      email_link: data.email_link?.trim() || null,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (!cleanTaskData.title) {
      throw new Error('Task title is required.');
    }

    let result;
    if (modalState.mode === 'create') {
      const { data: newTask, error: createError } = await supabase.from('tasks').insert({
        ...cleanTaskData,
        user_id: user.id,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (createError) throw createError;
      result = newTask;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'task',
        entity_id: result.id,
        details: { title: result.title }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Task created');
    } else if (modalState.mode === 'edit' && modalState.task) {
      const { data: updatedTask, error: updateError } = await supabase.from('tasks').update(cleanTaskData).eq('id', modalState.task.id).select().single();
      if (updateError) throw updateError;
      result = updatedTask;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'task',
        entity_id: result.id,
        details: { title: result.title }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      showToast.success('Task updated');
    }
    
    refetch();
  };

  const handleDelete = async (task: Task) => {
    if (!user) return;
    const isConfirmed = await confirm({
      title: 'Delete Task',
      message: `Are you sure you want to permanently delete this task: ${task.title}?`,
      confirmLabel: 'Delete Task',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error: dErr } = await supabase.from('tasks').delete().eq('id', task.id);
      
      if (dErr) throw dErr;

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'delete',
        entity_type: 'task',
        entity_id: task.id,
        details: { title: task.title }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      refetch();
      showToast.success('Task deleted successfully');
    } catch (err: any) {
      showToast.error(`Something went wrong: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Tasks</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Tasks</h2>
          <p className="text-white/40 text-sm mt-1">Manage your tasks across businesses, projects, and platforms.</p>
        </div>
        <button 
          onClick={() => setModalState({ isOpen: true, mode: 'create', task: null })}
          className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90"
        >
          <Plus size={18} />
          Add Task
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
        {/* Filters Header */}
        <div className="p-4 sm:p-8 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/[0.02] rounded-t-[2.5rem]">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            {['all', 'backlog', 'today', 'in_progress', 'waiting', 'done'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filter === f ? "bg-white text-slate-950 shadow-lg shadow-white/10" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text" 
              placeholder="Search tasks..."
              className="bg-black/40 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 w-full lg:w-80 transition-all placeholder:text-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="divide-y divide-white/5 bg-white/[0.01] rounded-b-[2.5rem]">
          {(loading && !tasks) ? (
            Array(8).fill(0).map((_, i) => <div key={i} className="h-20 w-full bg-white/5 animate-pulse last:rounded-b-[2.5rem]" />)
          ) : filteredTasks.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-6 rounded-b-[2.5rem]">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/10">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <p className="text-white font-bold uppercase tracking-[0.3em] text-sm italic opacity-20">No tasks found</p>
                <p className="text-[10px] text-white/10 uppercase font-bold tracking-widest mt-2">You are all caught up.</p>
              </div>
            </div>
          ) : (
            filteredTasks.map((task, index) => (
              <TaskRow 
                key={task.id} 
                task={task} 
                onRefresh={refetch} 
                aiSettings={aiSettings}
                onEdit={(t) => setModalState({ isOpen: true, mode: 'edit', task: t })}
                onView={(t) => setModalState({ isOpen: true, mode: 'view', task: t })}
                onDelete={handleDelete}
                isMenuOpen={openMenuId === task.id}
                setMenuOpen={(io) => setOpenMenuId(io ? task.id : null)}
                openUpwards={index > 0 && (index === filteredTasks.length - 1 || (filteredTasks.length >= 3 && index === filteredTasks.length - 2))}
              />
            ))
          )}
        </div>
      </div>

      <CreateModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.mode === 'create' ? "Add Task" : "Edit Task"}
        onSubmit={handleSubmit}
        mode={modalState.mode}
        initialValues={modalState.task}
        fields={[
          { name: 'title', label: 'Title', type: 'text', placeholder: 'Task title...' },
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Task details...' },
          { 
            name: 'business_id', 
            label: 'Business', 
            type: 'select', 
            options: [
              { label: 'Personal / Independent', value: '' },
              ...(businesses?.map(b => ({ label: b.name, value: b.id })) || [])
            ]
          },
          { 
            name: 'project_id', 
            label: 'Project', 
            type: 'select', 
            options: [
              { label: 'Independent Task', value: '' },
              ...(projects?.map(p => ({ label: p.name, value: p.id })) || [])
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
              { label: 'Backlog', value: 'backlog' },
              { label: 'Today', value: 'today' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Waiting', value: 'waiting' },
              { label: 'Completed', value: 'done' },
              { label: 'Cancelled', value: 'cancelled' }
            ],
            defaultValue: 'today'
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
          { name: 'due_date', label: 'Due Date', type: 'datetime-local' },
          { name: 'work_date', label: 'Scheduled Date', type: 'datetime-local' },
          { 
            name: 'recurring_type', 
            label: 'Recurrence', 
            type: 'select', 
            options: [
              { label: 'None', value: 'none' },
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' }
            ],
            defaultValue: 'none'
          },
          { name: 'recurring_config', label: 'Recurring Config (JSON)', type: 'textarea', placeholder: '{"days": [1, 3, 5]}' },
          { name: 'email_link', label: 'Email Link', type: 'text', placeholder: 'https://...' },
          { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional task notes...' }
        ]}
      />
    </div>
  );
}
