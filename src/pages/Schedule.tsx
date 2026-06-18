import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Plus, 
  ExternalLink, 
  MapPin, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Briefcase,
} from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useData';
import { supabase } from '../lib/supabaseClient';
import { useUI } from '../contexts/UIContext';
import { Task, CalendarAccount, CalendarEvent } from '../types';
import { cn } from '../lib/utils';

export default function Schedule() {
  const { showToast } = useUI();
  
  // Date states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [mobileShowMonth, setMobileShowMonth] = useState(false);

  // Queries
  const { data: accounts, refetch: refetchAccounts } = useSupabaseQuery<CalendarAccount[]>(
    () => supabase.from('calendar_accounts').select('*')
  );

  const { data: events, refetch: refetchEvents } = useSupabaseQuery<CalendarEvent[]>(
    () => supabase.from('calendar_events').select('*')
  );

  const { data: tasks, refetch: refetchTasks } = useSupabaseQuery<Task[]>(
    () => supabase.from('tasks')
      .select('*, project:projects(name)')
      .neq('status', 'done')
      .neq('status', 'cancelled')
  );

  // Auto handle connected param on callback navigation
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('calendar') === 'connected') {
      showToast.success('Google Calendar connected successfully!');
      // Trigger sync automatically
      triggerSync();
      // Clean query parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    const toastId = showToast.loading('Syncing Google Calendar events...');
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
  body: {
    time_min: new Date(year, month, 1).toISOString(),
    time_max: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString()
  }
});
      if (error) throw error;
      
      showToast.dismiss(toastId);

if (data?.errors?.length) {
  showToast.error(`Calendar sync issue: ${data.errors[0]}`);
} else {
  showToast.success(`Successfully synced ${data?.synced ?? 0} events!`);
}

refetchEvents();
refetchAccounts();
refetchTasks();
    } catch (err: any) {
      console.error('Calendar sync failed:', err);
      showToast.dismiss(toastId);
      showToast.error('Sync failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectCalendar = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth-start', {
        body: {
          display_color: '#3b82f6',
        }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('OAuth start did not yield a redirection URL');
      }
    } catch (err: any) {
      console.error('Calendar connection failed:', err);
      showToast.error('Failed to initiate calendar integration: ' + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Grid calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonthGrid = () => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0-6

    const days = [];

    // Fill in days from previous month
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthDaysCount = prevMonthDate.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDaysCount - i),
        isCurrentMonth: false,
      });
    }

    // Fill in days of current month
    const currMonthDate = new Date(year, month + 1, 0);
    const currMonthDaysCount = currMonthDate.getDate();
    for (let i = 1; i <= currMonthDaysCount; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Fill in days of next month padding to make full 42 grid cells
    const nextMonthPadding = 42 - days.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const parseScheduleDate = (value: string | null | undefined) => {
  if (!value) return null;

  // Supabase date fields like "2026-05-26" should be treated as local dates,
  // not UTC midnight, otherwise they can shift to the previous day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }

  return new Date(value);
};

const isDateOnly = (value: string | null | undefined) => {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const isSameDay = (d1: Date, d2Str: string | null | undefined) => {
  const d2 = parseScheduleDate(d2Str);
  if (!d2) return false;

  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  const getDayItems = (date: Date) => {
    const cellEvents = (events || []).filter(e => isSameDay(date, e.start_at));
    const cellTasks = (tasks || []).filter(t => {
      const taskDate = t.work_date || t.due_date;
      return isSameDay(date, taskDate);
    });

    const parsedEvents = cellEvents.map(e => ({
      type: 'event' as const,
      id: e.id,
      title: e.title,
      timeLabel: e.all_day ? 'All day' : formatTime(e.start_at),
      allDay: e.all_day,
      location: e.location,
      htmlLink: e.html_link,
      accountId: e.calendar_account_id,
      color: accounts?.find(a => a.id === e.calendar_account_id)?.display_color || '#3b82f6',
      rawTime: new Date(e.start_at)
    }));

    const parsedTasks = cellTasks.map(t => ({
      type: 'task' as const,
      id: t.id,
      title: t.title,
      timeLabel: t.work_date
  ? 'Scheduled'
  : t.due_date
    ? isDateOnly(t.due_date)
      ? 'Due today'
      : `Due ${formatTime(t.due_date)}`
    : 'Task',
      allDay: true,
      projectName: t.project?.name,
      priority: t.priority,
      status: t.status,
      rawTime: t.work_date ? parseScheduleDate(t.work_date) : parseScheduleDate(t.due_date)
    }));

    return [
      ...parsedEvents,
      ...parsedTasks
    ].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      if (!a.rawTime) return 1;
      if (!b.rawTime) return -1;
      return a.rawTime.getTime() - b.rawTime.getTime();
    });
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInWeek = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const gridDays = getDaysInMonthGrid();
  const weekDays = getDaysInWeek(selectedDate);
  const selectedDayItems = getDayItems(selectedDate);

  return (
    <div className="p-0 sm:p-8 max-w-7xl mx-auto space-y-8 text-white min-h-screen">
      {/* Header with quick integration actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Schedule</h1>
          <p className="text-xs text-white/40 uppercase tracking-widest mt-1">
            Unified Calendar mapping Google Events and incomplete Local Work Tasks
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {accounts && accounts.length > 0 ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
                  {accounts.length} Calendar Account{accounts.length > 1 ? 's' : ''} Connected
                </span>
              </div>
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-widest text-white transition-all duration-300 disabled:opacity-50"
              >
                <RefreshCw size={14} className={cn("text-blue-400", isSyncing && "animate-spin")} />
                Sync Calendar
              </button>
            </>
          ) : null}
          
          <button
            onClick={handleConnectCalendar}
            disabled={isConnecting}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-xs font-bold uppercase tracking-widest text-white transition-all duration-300 shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <Plus size={14} />
            {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
        </div>
      </div>

      {accounts && accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 bg-slate-900/50 border border-white/5 rounded-3xl">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider w-full mb-1">Active Sync Pipelines:</p>
          {accounts.map(account => (
            <div 
              key={account.id} 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white/80"
              style={{ borderLeft: `3px solid ${account.display_color || '#3b82f6'}` }}
            >
              <span className="font-bold">{account.email_address}</span>
              {account.last_synced_at && (
                <span className="text-[9px] text-white/40">
                  Synced: {new Date(account.last_synced_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile layout view switcher (Agenda / Month Grid) */}
      <div className="flex lg:hidden justify-between items-center bg-slate-900/40 p-1.5 border border-white/5 rounded-2xl">
        <span className="text-[10px] font-black text-white/50 tracking-wider uppercase pl-3">Schedule Mode</span>
        <div className="flex gap-1">
          <button
            onClick={() => setMobileShowMonth(false)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-350",
              !mobileShowMonth ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-white/40 hover:text-white"
            )}
          >
            Agenda
          </button>
          <button
            onClick={() => setMobileShowMonth(true)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-350",
              mobileShowMonth ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-white/40 hover:text-white"
            )}
          >
            Month Grid
          </button>
        </div>
      </div>

      {/* Main Grid and Schedule Detail Panel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Mobile Horizontal Week Selector (Visible on mobile ONLY when NOT in Month Grid view) */}
        {!mobileShowMonth && (
          <div className="block lg:hidden bg-slate-950/40 border border-white/5 rounded-3xl p-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Date</span>
              <span className="text-xs font-black text-blue-400 uppercase tracking-wide">
                {selectedDate.toLocaleDateString([], { month: 'short', year: 'numeric' })}
              </span>
            </div>
            
            {/* Horizontal week buttons */}
            <div className="grid grid-cols-7 gap-1.5 py-1">
              {weekDays.map((date, idx) => {
                const dayItems = getDayItems(date);
                const isSel = date.getFullYear() === selectedDate.getFullYear() &&
                              date.getMonth() === selectedDate.getMonth() &&
                              date.getDate() === selectedDate.getDate();
                const cellIsToday = isToday(date);
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2.5 rounded-2xl border transition-all duration-300 min-h-[64px]",
                      isSel ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.03]" : "bg-white/[0.02] border-white/5 text-white/50 hover:text-white hover:bg-white/5",
                      cellIsToday && !isSel && "border-blue-400 bg-blue-400/5 text-blue-300"
                    )}
                  >
                    <span className="text-[8px] font-black uppercase tracking-wider block mb-1">
                      {date.toLocaleDateString([], { weekday: 'narrow' })}
                    </span>
                    <span className="text-xs font-black tracking-tight leading-none">
                      {date.getDate()}
                    </span>
                    {dayItems.length > 0 && (
                      <span className={cn(
                        "w-1 h-1 rounded-full mt-1.5",
                        isSel ? "bg-white" : "bg-blue-400"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Month View container */}
        <div className={cn(
          "lg:col-span-2 bg-slate-950/40 border border-white/5 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md",
          mobileShowMonth ? "block" : "hidden lg:block"
        )}>
          {/* Calendar controls */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-blue-400" size={24} />
              <h2 className="text-xl font-bold tracking-tight text-white uppercase font-sans">
                {monthNames[month]} {year}
              </h2>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={prevMonth}
                className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/80 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={setToday}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest text-white/80 transition"
              >
                Today
              </button>
              <button 
                onClick={nextMonth}
                className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/80 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of week header line */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] uppercase tracking-widest text-white/30 mb-2 border-b border-white/5 pb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* 42 grid cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {gridDays.map((cell, idx) => {
              const dayItems = getDayItems(cell.date);
              const cellIsToday = isToday(cell.date);
              const isSelected = selectedDate ? (
                cell.date.getFullYear() === selectedDate.getFullYear() &&
                cell.date.getMonth() === selectedDate.getMonth() &&
                cell.date.getDate() === selectedDate.getDate()
              ) : false;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    "min-h-[90px] p-2 rounded-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden",
                    cell.isCurrentMonth ? "bg-white/[0.02]" : "bg-transparent opacity-25",
                    "border border-white/5 hover:border-white/10 hover:bg-white/[0.04]",
                    isSelected && "border-blue-500/80 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/5",
                    cellIsToday && "border-blue-400 bg-blue-400/5 shadow-inner"
                  )}
                >
                  {/* Top indicator of day number */}
                  <div className="flex items-center justify-between w-full">
                    <span className={cn(
                      "text-xs font-bold leading-none p-1.5 rounded-lg flex items-center justify-center min-w-[24px] min-h-[24px]",
                      cellIsToday && "bg-blue-500 text-white shadow-lg shadow-blue-500/20",
                      isSelected && !cellIsToday && "text-blue-400"
                    )}>
                      {cell.date.getDate()}
                    </span>
                    
                    {dayItems.length > 0 && (
                      <span className="text-[9px] font-black tracking-tighter text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Bubble previews of items */}
                  <div className="space-y-1 mt-2 flex-1 flex flex-col justify-end">
                    {dayItems.slice(0, 2).map((item, i) => (
                      <div 
                        key={item.id} 
                        className="text-[9px] font-bold truncate rounded px-1.5 py-0.5"
                        style={
                          item.type === 'event' 
                            ? { borderLeft: `2.5px solid ${item.color || '#3b82f6'}`, backgroundColor: `${item.color || '#3b82f6'}15`, color: '#e2e8f0' } 
                            : { borderLeft: `2.5px solid #10b981`, backgroundColor: '#10b98115', color: '#a7f3d0' }
                        }
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[8px] font-bold text-center text-white/30 uppercase tracking-widest leading-none pt-0.5">
                        +{dayItems.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected date agenda details sidebar */}
        <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
          <div className="border-b border-white/5 pb-4 mb-6">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">
              {selectedDate.toLocaleDateString([], { weekday: 'long' })}
            </p>
            <h3 className="text-xl font-bold tracking-tight text-white leading-tight">
              {selectedDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
          </div>

          <AnimatePresence mode="wait">
            {selectedDayItems.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mb-3 border border-white/5">
                  <CalendarIcon size={20} />
                </div>
                <p className="text-sm font-semibold text-white/40">Clean Slate</p>
                <p className="text-xs text-white/20 mt-1 max-w-[200px] mx-auto">
                  No Google events or local tasks registered for this day
                </p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 max-h-[500px] overflow-y-auto pr-2"
              >
                {selectedDayItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border transition duration-300 backdrop-blur-sm shadow flex flex-col gap-2.5 relative group overflow-hidden bg-slate-900/40 hover:bg-slate-900/80"
                    style={{ 
                      borderColor: item.type === 'event' ? `${item.color}25` : 'rgba(16, 185, 129, 0.15)',
                      borderLeft: item.type === 'event' ? `4px solid ${item.color}` : '4px solid #10b981'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-100 truncate leading-snug">
                          {item.title}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/40 font-medium pt-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                            item.type === 'event' ? "bg-blue-500/10 text-blue-300" : "bg-emerald-500/10 text-emerald-300"
                          )}>
                            {item.type === 'event' ? 'Google Event' : 'Local Task'}
                          </span>
                          
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            {item.timeLabel}
                          </span>
                        </div>
                      </div>

                      {item.type === 'event' && item.htmlLink && (
                        <a
                          href={item.htmlLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="opacity-40 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/5 text-blue-400 transition"
                          title="Open in Google Calendar"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    {/* Meta values and extra rows */}
                    {item.type === 'event' && item.location && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-white/40 bg-white/[0.02] border border-white/5 rounded-xl px-2.5 py-1 w-fit">
                        <MapPin size={11} className="text-blue-400" />
                        <span className="truncate max-w-[200px]">{item.location}</span>
                      </div>
                    )}

                    {item.type === 'task' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.projectName && (
                          <div className="flex items-center gap-1 text-[9px] font-black text-emerald-400/80 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-lg px-2 py-0.5 uppercase tracking-wider">
                            <Briefcase size={9} />
                            {item.projectName}
                          </div>
                        )}
                        {item.priority && (
                          <div className={cn(
                            "text-[9px] font-black rounded-lg px-2 py-0.5 uppercase tracking-wider border",
                            item.priority === 'urgent' && "bg-red-500/10 text-red-400 border-red-500/20",
                            item.priority === 'high' && "bg-orange-500/10 text-orange-400 border-orange-500/20",
                            item.priority === 'medium' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                            item.priority === 'low' && "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          )}>
                            {item.priority} priority
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
