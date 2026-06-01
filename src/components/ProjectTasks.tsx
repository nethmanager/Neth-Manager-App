import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertCircle,
  MoreVertical,
  Plus,
  Target,
  Trash2,
  Edit2,
  Calendar,
  Tag,
  StickyNote
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Project, Task } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';

interface ProjectTasksProps {
  project: Project;
  onUpdate?: () => void;
  createSignal?: string | number;
  onActionConsumed?: () => void;
}

export default function ProjectTasks({ project, onUpdate, createSignal, onActionConsumed }: ProjectTasksProps) {
  const { confirm, showToast } = useUI();
  const [isAdding, setIsAdding] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'today',
    priority: 'medium',
    due_date: '',
    work_date: '',
    notes: ''
  });

  const { data: tasks, refetch, loading: loadingList } = useSupabaseQuery<Task[]>(
    () => supabase.from('tasks').select('*').eq('project_id', project.id).neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false }),
    [project.id]
  );

  // Handle createSignal
  useEffect(() => {
    if (createSignal) {
      startAdding();
      if (onActionConsumed) onActionConsumed();
    }
  }, [createSignal]);

  const startAdding = () => {
    setFormData({
      title: '',
      description: '',
      status: 'today',
      priority: 'medium',
      due_date: '',
      work_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setEditingTask(null);
    setIsAdding(true);
  };

  const startEditing = (task: Task) => {
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status || 'today',
      priority: task.priority || 'medium',
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
      work_date: task.work_date ? new Date(task.work_date).toISOString().split('T')[0] : '',
      notes: task.notes || ''
    });
    setEditingTask(task);
    setIsAdding(false);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      showToast.error('Task title is required');
      return;
    }

    setLoadingForm(true);
    try {
      const taskData = {
        user_id: project.user_id,
        business_id: project.business_id,
        project_id: project.id,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        work_date: formData.work_date || null,
        notes: formData.notes,
        updated_at: new Date().toISOString()
      };

      if (editingTask) {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
        if (error) throw error;
        showToast.success('Task updated');
      } else {
        const { error } = await supabase.from('tasks').insert({
          ...taskData,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
        showToast.success('Task created');
      }

      setIsAdding(false);
      setEditingTask(null);
      refetch();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast.error('Failed to save task: ' + err.message);
    } finally {
      setLoadingForm(false);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'today' : 'done';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'done' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;
      refetch();
      if (onUpdate) onUpdate();
      showToast.success(`Task marked as ${newStatus}`);
    } catch (err: any) {
      showToast.error('Failed to update task: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Cancel Task',
      message: 'Are you sure you want to cancel/hide this task?',
      confirmLabel: 'Cancel Task',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      refetch();
      if (onUpdate) onUpdate();
      showToast.success('Task cancelled');
    } catch (err: any) {
      showToast.error('Failed to cancel task: ' + err.message);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'medium': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-white/40 bg-white/5 border-white/5';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Project Tasks</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Actions and milestones for this project</p>
        </div>
        <button
          onClick={startAdding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {(isAdding || editingTask) && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Task Title</label>
            <input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              required 
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
              placeholder="What needs to be done?" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Status</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="backlog">Backlog</option>
                <option value="today">Today</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Priority</label>
              <select 
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Work Date</label>
              <input 
                type="date"
                value={formData.work_date} 
                onChange={e => setFormData({...formData, work_date: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Due Date</label>
              <input 
                type="date"
                value={formData.due_date} 
                onChange={e => setFormData({...formData, due_date: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Description</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none min-h-[80px]" 
              placeholder="Task details and scope..." 
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loadingForm}
              className="flex-1 py-3 rounded-xl bg-white text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl"
            >
              {loadingForm ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </button>
            <button
              onClick={() => { setIsAdding(false); setEditingTask(null); }}
              className="px-6 py-3 rounded-xl border border-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loadingList ? (
          <div className="py-8 flex justify-center">
            <Clock className="animate-spin text-white/10" />
          </div>
        ) : tasks?.length === 0 ? (
          <div className="py-12 bg-white/5 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center opacity-40">
            <CheckSquare size={32} className="mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No tasks linked to this project</p>
          </div>
        ) : (
          tasks?.map(task => (
            <div key={task.id} className="group bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-white/10 transition-all">
              <button 
                onClick={() => toggleTaskStatus(task)}
                className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                  task.status === 'done' 
                    ? "bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" 
                    : "border-white/10 text-transparent hover:border-emerald-500/50 hover:text-emerald-500/30"
                )}
              >
                <CheckSquare size={14} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className={cn(
                    "text-xs font-bold transition-all truncate",
                    task.status === 'done' ? "text-white/20 line-through" : "text-white"
                  )}>
                    {task.title}
                  </h5>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                    getPriorityColor(task.priority)
                  )}>
                    {task.priority}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {(task.due_date || task.work_date) && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-white/20 uppercase tracking-tighter">
                      <Calendar size={10} />
                      {task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString()}` : `Work ${new Date(task.work_date!).toLocaleDateString()}`}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[9px] font-bold text-white/20 uppercase tracking-tighter">
                    <Target size={10} />
                    {task.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEditing(task)} className="p-2 text-white/30 hover:text-white transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(task.id)} className="p-2 text-white/30 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
