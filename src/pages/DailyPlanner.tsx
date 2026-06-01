import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Zap, 
  Clock, 
  CheckCircle2, 
  Circle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Edit3
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import { Task, CalendarEvent } from '../types';

import { generateResponse } from '../lib/localAIService';

import { useAI } from '../contexts/AIContext';
import { useUI } from '../contexts/UIContext';
import CreateModal from '../components/CreateModal';

export default function DailyPlanner() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { aiSettings } = useAI();
  const { showToast } = useUI();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: plan, loading: loadingPlan, refetch: refetchPlan } = useSupabaseQuery<any>(
    () => {
      if (!user?.id) return Promise.resolve({ data: null, error: null as any });
      return supabase.from('daily_plans').select('*').eq('user_id', user.id).eq('date', selectedDate).maybeSingle();
    },
    [user?.id, selectedDate]
  );

  const { data: todayTasks } = useSupabaseQuery<Task[]>(
    () => {
      if (!user?.id) return Promise.resolve({ data: null, error: null as any });
      return supabase.from('tasks').select('*').eq('user_id', user.id).eq('status', 'today');
    },
    [user?.id]
  );

  const { data: allEvents, refetch: refetchEvents } = useSupabaseQuery<CalendarEvent[]>(
    () => {
      if (!user?.id) return Promise.resolve({ data: null, error: null as any });
      return supabase.from('calendar_events')
        .select('*, account:calendar_accounts(email_address, display_name)')
        .eq('user_id', user.id);
    },
    [user?.id]
  );

  const dailyEvents = (allEvents || []).filter(e => {
    if (!e.start_at) return false;
    const eventStartDate = e.start_at.slice(0, 10);
    const eventEndDate = e.end_at ? e.end_at.slice(0, 10) : eventStartDate;
    return selectedDate >= eventStartDate && selectedDate <= eventEndDate;
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleUpdatePlan = async (data: any) => {
    if (!user) return;
    
    const topPriorities = typeof data.top_priorities === 'string' 
      ? data.top_priorities.split(',').map((p: string) => p.trim()).filter((p: string) => p)
      : data.top_priorities;

    let timeBlocks = data.time_blocks;
    if (typeof data.time_blocks === 'string' && data.time_blocks.trim()) {
      try {
        timeBlocks = JSON.parse(data.time_blocks);
      } catch (err) {
        showToast.error('Invalid Timeline format. Please use valid JSON (e.g., [{"time": "09:00", "task": "Task Name"}]).');
        return;
      }
    }

    const submissionData = {
      ...data,
      top_priorities: topPriorities,
      time_blocks: timeBlocks,
      user_id: user.id,
      date: selectedDate,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('daily_plans').upsert(submissionData, {
  onConflict: 'user_id,date'
});
    if (error) throw error;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'update_plan',
      entity_type: 'daily_plan',
      details: { date: selectedDate }
    });

    showToast.success('Daily plan updated');
    refetchPlan();
  };

  const handleGeneratePlan = async () => {
    if (!user) return;
    
    if (!aiSettings?.enabled) {
      showToast.error("AI is disabled. Please enable it in Settings.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const taskList = todayTasks?.map(t => `- ${t.title}`).join('\n') || "No tasks scheduled.";
      const eventList = dailyEvents.map(e => {
        const timeStr = e.all_day ? 'All Day' : `${new Date(e.start_at).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false})} - ${new Date(e.end_at).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', hour12: false})}`;
        return `- [CALENDAR EVENT] "${e.title}" at (${timeStr})${e.location ? ` location: ${e.location}` : ''}`;
      }).join('\n') || "No calendar events today.";

      const prompt = `Based on the following tasks and fixed calendar commitments for today (${selectedDate}), generate a strategic daily plan, identify the top 3 priorities, and schedule dynamic time blocks for tasks.
      
      CRITICAL RULE:
      You MUST NOT schedule any time blocks or tasks that overlap with the listed CALENDAR COMMITMENTS. Treat calendar commitments as fixed slot blocks that cannot be overridden or double-booked.
      
      Calendar Commitments (Fixed Blocks):
      ${eventList}
      
      Tasks to Schedule:
      ${taskList}
      
      Format your response exactly like this:
      SUMMARY: [A concise, professional 2-3 sentence strategic daily overview. Mention calendar events gracefully.]
      PRIORITIES: [Priority 1], [Priority 2], [Priority 3]
      SCHEDULE_JSON: [{"time": "08:00", "task": "Task name"}, {"time": "14:00", "task": "Another task"}]`;

      const response = await generateResponse(
        aiSettings.ollama_endpoint,
        aiSettings.model_name,
        prompt,
        "You are Neth, a strategic AI assistant. Keep schedule time block definitions to clean HH:MM formats.",
        aiSettings.temperature,
        aiSettings.max_tokens
      );

      const summaryMatch = response.match(/SUMMARY:\s*(.*)/i);
      const prioritiesMatch = response.match(/PRIORITIES:\s*(.*)/i);
      const jsonMatch = response.match(/SCHEDULE_JSON:\s*(\[[\s\S]*\])/i);

      const morningPlan = summaryMatch ? summaryMatch[1].trim() : response.slice(0, 200);
      const topPriorities = prioritiesMatch 
        ? prioritiesMatch[1].split(',').map(p => p.trim()).filter(p => p) 
        : todayTasks?.slice(0, 3).map(t => t.title) || [];

      let timeBlocks: any[] = [];
      if (jsonMatch) {
        try {
          timeBlocks = JSON.parse(jsonMatch[1].trim());
        } catch (e) {
          console.warn("Failed to parse AI generated schedule json:", e);
        }
      }

      // Conflict-free fallback if valid timeBlocks JSON was not returned or was empty
      if (!Array.isArray(timeBlocks) || timeBlocks.length === 0) {
        let currentHour = 9;
        const formattedBlocks = [];
        for (const t of (todayTasks || [])) {
          let hasConflict = false;
          // Check if this hour overlaps with any of the dailyEvents
          for (const ev of dailyEvents) {
            if (ev.all_day) {
              hasConflict = true;
              continue;
            }
            try {
              const startHour = new Date(ev.start_at).getHours();
              const endHour = new Date(ev.end_at).getHours();
              if (currentHour >= startHour && currentHour < endHour) {
                hasConflict = true;
              }
            } catch (_) {}
          }
          if (hasConflict) {
            currentHour += 1;
            continue;
          }
          formattedBlocks.push({ 
            time: `${currentHour.toString().padStart(2, '0')}:00`, 
            task: t.title 
          });
          currentHour += 1;
          if (currentHour > 17) break;
        }
        timeBlocks = formattedBlocks;
      }

      const { error } = await supabase.from('daily_plans').upsert({
        user_id: user.id,
        date: selectedDate,
        morning_plan: morningPlan,
        top_priorities: topPriorities,
        time_blocks: timeBlocks,
        ai_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      });

      if (error) throw error;
      showToast.success('AI plan generated');
      refetchPlan();
    } catch (error) {
      console.error('Failed to generate AI plan:', error);
      showToast.error('Could not reach Ollama. Defaulting to basic plan.');
      
      // Fallback to simple logic
      const topPriorities = todayTasks?.slice(0, 3).map(t => t.title) || [];
      const morningPlan = todayTasks?.length ? `Focus on completing ${todayTasks[0].title} first thing.` : "Review your backlog and set clear objectives.";

     await supabase.from('daily_plans').upsert({
  user_id: user.id,
  date: selectedDate,
  morning_plan: morningPlan,
  top_priorities: topPriorities,
  ai_generated_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  onConflict: 'user_id,date'
});
      refetchPlan();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="p-4 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
            <Calendar size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight leading-none mb-2">Daily Plan</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }} className="text-white/20 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
              <p className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mono">{new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <button onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }} className="text-white/20 hover:text-white transition-colors"><ChevronRight size={20} /></button>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95"
          >
            <Edit3 size={18} />
            Edit Daily Plan
          </button>
          <button 
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90"
          >
            <Zap size={18} className={cn(isGenerating && "animate-pulse")} />
            {isGenerating ? 'Thinking...' : 'AI Generate'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Objectives & Plan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm">
            <div className="mb-8">
              <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                <Target size={16} /> Overview
              </h3>
              <p className="text-white/80 leading-relaxed text-xl italic border-l-2 border-blue-500/30 pl-8 mb-8">
                {plan?.morning_plan || "No plan generated for this date yet."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Top Priorities</h4>
                {(Array.isArray(plan?.top_priorities) ? plan.top_priorities : []).map((priority: string, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all">
                    <div className="mt-1">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    </div>
                    <span className="text-white font-bold group-hover:text-blue-400 transition-colors uppercase tracking-tight text-xs">{priority}</span>
                  </div>
                ))}
                {(!plan?.top_priorities || plan.top_priorities.length === 0) && (
                  <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-3xl text-white/10 text-[9px] font-black uppercase tracking-widest leading-loose">
                    No priorities set
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Schedule</h4>
                {plan?.time_blocks && Array.isArray(plan.time_blocks) ? (
                  <div className="space-y-3">
                    {plan.time_blocks.map((block: any, i: number) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                        <span className="text-[10px] font-mono text-white/30 w-12">{block.time}</span>
                        <div className="w-px h-4 bg-white/10" />
                        <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">{block.task}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-3xl text-white/10 text-[9px] font-black uppercase tracking-widest leading-loose">
                    No schedule set
                  </div>
                )}
              </div>
            </div>

            {plan?.notes && (
              <div className="mt-10 pt-8 border-t border-white/5">
                <h4 className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-3">Notes</h4>
                <p className="text-sm text-white/50 leading-loose">{plan.notes}</p>
              </div>
            )}
          </div>

          {plan?.end_day_review && (
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-[0.2em] mb-6">End Day Review</h3>
              <p className="text-white/60 leading-relaxed text-sm italic">{plan.end_day_review}</p>
            </div>
          )}
        </div>

        {/* Right: Timeline/Tasks */}
        <div className="space-y-6">
          {/* Calendar commitments */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-3">
              <Calendar size={18} className="text-blue-400" /> Fixed Commitments
            </h3>
            <div className="space-y-3">
              {dailyEvents && dailyEvents.length > 0 ? (
                dailyEvents.map((event) => {
                  const startTime = !event.all_day && event.start_at 
                    ? new Date(event.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                    : 'All Day';
                  const endTime = !event.all_day && event.end_at 
                    ? new Date(event.end_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                    : '';
                  return (
                    <div key={event.id} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white truncate max-w-[150px] block">{event.title}</span>
                        <span className="text-[9px] font-mono text-blue-400 font-bold shrink-0">
                          {startTime}{endTime ? ` - ${endTime}` : ''}
                        </span>
                      </div>
                      {(event.location || event.account?.email_address) && (
                        <div className="flex flex-wrap items-center gap-2 text-[9px] text-white/40 uppercase tracking-wider">
                          {event.location && <span className="truncate max-w-[120px]">📍 {event.location}</span>}
                          {event.account?.email_address && <span className="truncate max-w-[120px]">📧 {event.account.email_address}</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-4 text-white/20 text-[10px] font-bold uppercase tracking-widest">No calendar commitments</p>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-3">
              <Clock size={18} className="text-purple-400" /> Today's Tasks
            </h3>
            <div className="space-y-3">
              {todayTasks?.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", task.status === 'done' ? 'bg-emerald-500' : 'bg-blue-500')} />
                  <span className={cn("flex-1 truncate", task.status === 'done' ? 'text-white/30 line-through' : 'text-white/70')}>{task.title}</span>
                </div>
              ))}
              {(!todayTasks || todayTasks.length === 0) && (
                <p className="text-center py-4 text-white/20 text-[10px] font-bold uppercase tracking-widest">No tasks set for today</p>
              )}
            </div>
            <button 
              onClick={() => navigate('/tasks')}
              className="w-full mt-6 py-3 rounded-xl border border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
            >
              Manage Backlog
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-center gap-3 mb-3">
              <Zap size={18} className="text-emerald-400" />
              <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Daily Efficiency</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Progress</span>
                <span className="text-[10px] font-bold text-white/60 tracking-wider">82%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[82%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Daily Plan"
        onSubmit={handleUpdatePlan}
        initialValues={{
          ...plan,
          top_priorities: plan?.top_priorities?.join(', ') || '',
          time_blocks: plan?.time_blocks ? JSON.stringify(plan.time_blocks, null, 2) : ''
        }}
        fields={[
          { name: 'morning_plan', label: 'Morning Plan', type: 'textarea', placeholder: 'Strategic overview...' },
          { name: 'top_priorities', label: 'Top Priorities (Comma Separated)', type: 'text', placeholder: 'Priority 1, Priority 2, Priority 3' },
          { name: 'time_blocks', label: 'Schedule (JSON)', type: 'textarea', placeholder: '[{"time": "08:00", "task": "Project focus"}]' },
          { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional details...' },
          { name: 'end_day_review', label: 'End Day Review', type: 'textarea', placeholder: 'What was achieved?' },
        ]}
      />
    </div>
  );
}
