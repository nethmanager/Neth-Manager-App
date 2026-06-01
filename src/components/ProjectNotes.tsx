import React, { useState, useEffect } from 'react';
import { 
  StickyNote, 
  Save, 
  Clock,
  Layout,
  Maximize2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Project } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';

interface ProjectNotesProps {
  project: Project;
}

export default function ProjectNotes({ project }: ProjectNotesProps) {
  const { showToast } = useUI();
  const [notes, setNotes] = useState(project.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;
      setLastSaved(new Date());
      showToast.success('Notes saved');
    } catch (err: any) {
      showToast.error('Failed to save notes: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save debounced would be nice, but let's stick to manual for now or simple interval
  useEffect(() => {
    setNotes(project.notes || '');
  }, [project.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Project Notes</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Freeform thoughts and documentation</p>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-1">
              <Clock size={10} /> Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || notes === project.notes}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95",
              notes === project.notes 
                ? "bg-white/5 text-white/20 cursor-default" 
                : "bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-500"
            )}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-slate-950 border border-white/5 rounded-[2rem] overflow-hidden min-h-[500px] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <StickyNote size={12} className="text-blue-400" />
              <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{project.name} Workspace</span>
            </div>
            <button className="p-1 px-2 text-[8px] font-black text-white/20 hover:text-white uppercase tracking-[0.3em] transition-colors">
              Markdown Enabled
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Start writing thoughts, project specs, or meeting notes..."
            className="flex-1 w-full p-8 bg-transparent text-white/80 text-sm leading-relaxed focus:outline-none resize-none font-sans"
          />
        </div>
      </div>
    </div>
  );
}
