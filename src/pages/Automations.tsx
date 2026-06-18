import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Play, 
  Trash, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Activity, 
  Bell, 
  Check, 
  X, 
  RefreshCw, 
  Settings, 
  User, 
  Database, 
  Eye, 
  Lock, 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  Shield,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Agent {
  id: string;
  name: string;
  model_provider: string;
  role: string;
}

interface Automation {
  id: string;
  name: string;
  agent_id: string;
  automation_type: string;
  description: string;
  enabled: boolean;
  schedule_type: string;
  schedule_config: any;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  requires_confirmation?: boolean;
}

interface AutomationRun {
  id: string;
  status: string;
  output_summary: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  automation: {
    id: string;
    name: string;
    automation_type: string;
  } | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

interface PendingAction {
  id: string;
  action_type: string;
  entity_type: string;
  payload: any;
  summary: string;
  status: string;
  created_at: string;
  agent_id: string;
}

export default function Automations() {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'pending' | 'logs' | 'notifications'>('scheduler');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Create Automation');
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formAgentId, setFormAgentId] = useState('');
  const [formType, setFormType] = useState('daily_briefing');
  const [formDescription, setFormDescription] = useState('');
  const [formScheduleType, setFormScheduleType] = useState('daily');
  const [formTime, setFormTime] = useState('08:00');
  const [formIntervalHours, setFormIntervalHours] = useState('1');
  const [formWeekday, setFormWeekday] = useState('monday');
  const [formMonthDay, setFormMonthDay] = useState('1');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formRequiresConfirmation, setFormRequiresConfirmation] = useState(true);

  // Selected JSON payload modal view
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);

  const fetchAllData = async () => {
    setIsRefreshing(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch automations
      const autRes = await fetch('/api/automations', { headers });
      if (autRes.ok) {
        const data = await autRes.json();
        setAutomations(data.automations || []);
      }

      // Fetch runs log history
      const runsRes = await fetch('/api/automations/runs', { headers });
      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.runs || []);
      }

      // Fetch notifications
      const notifRes = await fetch('/api/notifications', { headers });
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications || []);
      }

      // Fetch agents
      const { data: agentList } = await supabase.from('ai_agents').select('id, name, model_provider, role');
      if (agentList) setAgents(agentList);

      // Fetch pending actions
      const { data: actionsList, error: actError } = await supabase
        .from('ai_pending_actions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!actError && actionsList) {
        setPendingActions(actionsList);
      }

    } catch (err) {
      console.error('Error loading automations system data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleOpenCreateModal = () => {
    setModalTitle('Create Automation');
    setEditingAutomationId(null);
    setFormName('');
    setFormAgentId(agents[0]?.id || '');
    setFormType('daily_briefing');
    setFormDescription('');
    setFormScheduleType('daily');
    setFormTime('08:00');
    setFormIntervalHours('1');
    setFormWeekday('monday');
    setFormMonthDay('1');
    setFormEnabled(true);
    setFormRequiresConfirmation(true);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (aut: Automation) => {
    setModalTitle('Edit Automation');
    setEditingAutomationId(aut.id);
    setFormName(aut.name);
    setFormAgentId(aut.agent_id);
    setFormType(aut.automation_type);
    setFormDescription(aut.description || '');
    setFormScheduleType(aut.schedule_type);
    setFormTime(aut.schedule_config?.time || '08:00');
    setFormIntervalHours(String(aut.schedule_config?.hours || '1'));
    setFormWeekday(aut.schedule_config?.weekday || 'monday');
    setFormMonthDay(String(aut.schedule_config?.day || '1'));
    setFormEnabled(aut.enabled);
    setFormRequiresConfirmation(aut.requires_confirmation !== false);
    setIsCreateModalOpen(true);
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const schedule_config: any = {};
      if (formScheduleType === 'hourly') {
        schedule_config.hours = Number(formIntervalHours);
      } else if (formScheduleType === 'daily') {
        schedule_config.time = formTime;
      } else if (formScheduleType === 'weekly') {
        schedule_config.time = formTime;
        schedule_config.weekday = formWeekday;
      } else if (formScheduleType === 'monthly') {
        schedule_config.time = formTime;
        schedule_config.day = Number(formMonthDay);
      }

      const body = {
        name: formName,
        agent_id: formAgentId,
        automation_type: formType,
        description: formDescription,
        enabled: formEnabled,
        schedule_type: formScheduleType,
        schedule_config,
        requires_confirmation: formRequiresConfirmation
      };

      const url = editingAutomationId ? `/api/automations/${editingAutomationId}` : '/api/automations';
      const method = editingAutomationId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        fetchAllData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to save automation.');
      }
    } catch (err) {
      console.error('Error saving automation:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/automations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error('Error deleting automation:', err);
    }
  };

  const handleToggleEnable = async (aut: Automation) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/automations/${aut.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !aut.enabled })
      });

      if (res.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error('Error toggling automation state:', err);
    }
  };

  const handleManualRun = async (id: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      setIsRefreshing(true);
      const res = await fetch(`/api/automations/run/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        alert('Manual automation started successfully. Check logs for agent output.');
        fetchAllData();
      } else {
        const err = await res.json();
        alert(`Error running task: ${err.error}`);
      }
    } catch (err) {
      console.error('Error manually running automation:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleResolveAction = async (id: string, approve: boolean) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      setIsRefreshing(true);
      const actionName = approve ? 'Approved' : 'Rejected/Skipped';

      const res = await fetch('/api/assistant/action/resolve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action_id: id, execute: approve })
      });

      if (res.ok) {
        alert(`Action ${actionName} successfully.`);
        // Refresh
        const { data: actionsList } = await supabase
          .from('ai_pending_actions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (actionsList) {
          setPendingActions(actionsList);
        }
        fetchAllData();
      } else {
        const err = await res.json();
        alert(`Error resolving action: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Error resolving action:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const pendingCount = pendingActions.length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-t-indigo-500 border-white/5 rounded-full animate-spin mb-4" />
        <p className="text-white/60 font-medium text-sm">Loading AI scheduler environment...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Box */}
      <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-black text-[10px] tracking-widest uppercase flex items-center gap-1.5 shadow-lg shadow-indigo-500/10">
                <Zap size={10} className="fill-white" /> AI System
              </div>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Daemon Listening
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">AI Automation & Scheduler</h1>
            <p className="text-xs sm:text-sm text-white/50 max-w-xl mt-1 leading-relaxed">
              Define background checks, compile briefs, categorize unread items, or alert financial shifts completely autonomously.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={fetchAllData}
              disabled={isRefreshing}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:text-white transition-all ${isRefreshing ? 'animate-spin text-blue-400' : ''}`}
              title="Refresh Data"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-extrabold uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/20 transition-all font-mono"
            >
              <Plus size={16} /> New Automation
            </button>
          </div>
        </div>
      </div>



      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all font-mono
            ${activeTab === 'scheduler' 
              ? 'border-indigo-500 text-white' 
              : 'border-transparent text-white/40 hover:text-white/70'}`}
        >
          <Calendar size={14} /> Scheduler Configuration
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all font-mono relative
            ${activeTab === 'pending' 
              ? 'border-indigo-500 text-white' 
              : 'border-transparent text-white/40 hover:text-white/70'}`}
        >
          <Shield size={14} /> Pending Actions
          {pendingCount > 0 && (
            <span className="absolute top-2.5 right-0.5 w-4 h-4 bg-orange-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center font-sans animate-bounce">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all font-mono relative
            ${activeTab === 'notifications' 
              ? 'border-indigo-500 text-white' 
              : 'border-transparent text-white/40 hover:text-white/70'}`}
        >
          <Bell size={14} /> Notifications Alerts
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-0.5 w-4 h-4 bg-indigo-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center font-sans">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all font-mono
            ${activeTab === 'logs' 
              ? 'border-indigo-500 text-white' 
              : 'border-transparent text-white/40 hover:text-white/70'}`}
        >
          <Activity size={14} /> Execution Logs
        </button>
      </div>

      {/* 4. Tab Content Panels */}
      <div className="min-h-[300px]">
        {/* TAB 1: SCHEDULER DESIGNER */}
        {activeTab === 'scheduler' && (
          <div className="space-y-6">
            {automations.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center">
                <Calendar size={48} className="text-white/10 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-white mb-1">No automations configured</h4>
                <p className="text-xs text-white/40 max-w-sm mx-auto mb-6">
                  Set up background tasks to let designated AI agents periodically review your mail status, plan tasks, or summarize business reports.
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl font-mono shadow-md"
                >
                  Create First Automation
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {automations.map((aut) => {
                  const assignedAgent = agents.find(ag => ag.id === aut.agent_id);
                  return (
                    <div 
                      key={aut.id} 
                      className={`bg-slate-900 border rounded-3xl p-6 flex flex-col justify-between transition-all group
                        ${aut.enabled ? 'border-white/5' : 'border-white/5 bg-slate-900/50 opacity-60'}`}
                    >
                      <div>
                        {/* Upper row header */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-black tracking-widest text-indigo-400 border border-indigo-400/20 px-2 py-0.5 rounded-full bg-indigo-500/5 uppercase font-mono">
                                {aut.automation_type.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-white/30 font-semibold flex items-center gap-1 font-mono">
                                <Clock size={10} /> {aut.schedule_type}
                              </span>
                            </div>
                            <h3 className="font-bold text-md text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{aut.name}</h3>
                          </div>

                          {/* Toggle switch */}
                          <button
                            onClick={() => handleToggleEnable(aut)}
                            className={`w-12 h-6 rounded-full p-0.5 transition-colors relative cursor-pointer ${aut.enabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${aut.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* Description */}
                        {aut.description && (
                          <p className="text-xs text-white/50 mb-4 line-clamp-2 leading-relaxed">
                            {aut.description}
                          </p>
                        )}

                        {/* Assignee / Config parameters details */}
                        <div className="bg-slate-950/60 rounded-2xl p-4 border border-white/5 mb-6 space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <User className="text-white/30 shrink-0" size={14} />
                            <span className="text-white/40">Responsible Agent:</span>
                            <span className="text-white/80 font-bold font-mono text-[11px]">{assignedAgent ? assignedAgent.name : 'Emily (Default)'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Shield className="text-white/30 shrink-0" size={14} />
                            <span className="text-white/40">Confirmation Needed:</span>
                            <span className="text-white/80 font-bold font-mono text-[11px]">{aut.requires_confirmation !== false ? "Yes" : "No"}</span>
                          </div>
                          {aut.schedule_type === 'hourly' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                              <span className="text-indigo-400">→</span> Trigger interval: Every {aut.schedule_config?.hours || 1} hour(s)
                            </div>
                          )}
                          {aut.schedule_type === 'daily' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                              <span className="text-indigo-400">→</span> Trigger timing: Everyday at {aut.schedule_config?.time || '08:00'}
                            </div>
                          )}
                          {aut.schedule_type === 'weekly' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                              <span className="text-indigo-400">→</span> Trigger timing: Weekly {aut.schedule_config?.weekday} at {aut.schedule_config?.time || '08:00'}
                            </div>
                          )}
                          {aut.schedule_type === 'monthly' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                              <span className="text-indigo-400">→</span> Trigger timing: Day {aut.schedule_config?.day} of month at {aut.schedule_config?.time || '08:00'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lower actions buttons */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
                        <div className="text-[10px] text-white/30 font-semibold font-mono space-y-0.5">
                          <div>LAST RUN: {aut.last_run_at ? new Date(aut.last_run_at).toLocaleString() : 'Never'}</div>
                          <div>NEXT RUN: {aut.next_run_at ? new Date(aut.next_run_at).toLocaleString() : 'N/A'}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleManualRun(aut.id)}
                            disabled={!aut.enabled}
                            className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                            title="Run Immediately Now"
                          >
                            <Play size={14} className="fill-white" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(aut)}
                            className="px-3 py-2 border border-white/10 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 hover:text-indigo-400 transition-all text-[11px] font-bold font-mono uppercase"
                          >
                            Configure
                          </button>
                          <button
                            onClick={() => handleDelete(aut.id)}
                            className="p-2 border border-red-500/20 rounded-xl bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all hover:scale-105"
                            title="Delete"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PENDING ACTIONS RESOLVER */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {pendingActions.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center">
                <Shield size={48} className="text-white/10 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-white mb-1">Queue is fully clear</h4>
                <p className="text-xs text-white/40 max-w-sm mx-auto">
                  Any critical or risky updates proposed by scheduled background agents are safely isolated here for your approval.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingActions.map((act) => {
                  const actionAgent = agents.find(ag => ag.id === act.agent_id);
                  return (
                    <div 
                      key={act.id} 
                      className="bg-slate-900 border border-white/5 rounded-3xl p-6 hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="space-y-3 flex-1">
                          {/* Heading attributes */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-bold tracking-wider font-mono uppercase border border-orange-500/10 animate-pulse">
                              Pending Confirmation
                            </span>
                            <span className="text-xs font-bold text-white/40 font-mono">
                              AGENT: {actionAgent ? actionAgent.name : 'Autonomous Agent'}
                            </span>
                            <span className="text-[10px] text-white/30 font-mono">
                              Proposed {new Date(act.created_at).toLocaleString()}
                            </span>
                          </div>

                          {/* Explanatory summary text */}
                          <div>
                            <h4 className="text-sm font-bold text-white leading-relaxed">{act.summary}</h4>
                          </div>

                          {/* Technical attributes */}
                          <div className="flex items-center gap-4 text-xs font-mono text-white/40">
                            <div>Action Type: <span className="text-indigo-400">{act.action_type}</span></div>
                            <div>Entity: <span className="text-indigo-400">{act.entity_type}</span></div>
                            <button
                              onClick={() => setSelectedPayload(act.payload)}
                              className="text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <FileText size={12} /> View proposed JSON parameters
                            </button>
                          </div>
                        </div>

                        {/* Button controls */}
                        <div className="flex sm:flex-row md:flex-col items-center gap-2 shrink-0 self-end md:self-start">
                          <button
                            onClick={() => handleResolveAction(act.id, true)}
                            className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[11px] font-mono tracking-wider text-white font-extrabold uppercase flex items-center justify-center gap-1.5 transition-all outline-none"
                          >
                            <Check size={14} /> Approve & Write
                          </button>
                          <button
                            onClick={() => handleResolveAction(act.id, false)}
                            className="w-full px-5 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 text-[11px] font-mono tracking-wider text-white/70 hover:text-red-400 rounded-xl font-extrabold uppercase flex items-center justify-center gap-1.5 transition-all outline-none"
                          >
                            <X size={14} /> Reject & Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS CENTER */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {notifications.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center">
                <Bell size={48} className="text-white/10 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-white mb-1">Your notification feed is empty</h4>
                <p className="text-xs text-white/40 max-w-sm mx-auto">
                  Safe summaries, daily briefings, and status warnings are sent directly to this board.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`bg-slate-900 border rounded-3xl p-6 transition-all relative overflow-hidden
                      ${notif.is_read ? 'border-white/5 opacity-60' : 'border-indigo-500/20 shadow-lg shadow-indigo-500/5'}`}
                  >
                    {!notif.is_read && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                    )}
                    <div className="flex items-start justify-between gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">{notif.title}</h4>
                          <span className="text-[10px] text-white/30 font-mono">
                            {new Date(notif.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed max-w-2xl whitespace-pre-wrap">{notif.message}</p>
                      </div>

                      {/* Notified status or control */}
                      {!notif.is_read ? (
                        <button
                          onClick={() => handleMarkNotificationRead(notif.id)}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 text-[10px] font-mono text-white hover:bg-white/15 rounded-xl uppercase tracking-widest transition-all font-black shrink-0"
                        >
                          Mark Read
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold font-mono text-white/20 uppercase tracking-widest shrink-0">Read</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SYSTEM RUN LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider font-mono">Diagnostic Log Audit Stream</span>
              <span className="text-[10px] font-bold text-white/30 uppercase font-mono">Showing latest 30 runs</span>
            </div>
            {runs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity size={32} className="text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/40">No system execution log logs currently recorded.</p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40 uppercase font-mono tracking-widest text-[10px]">
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Automation Name</th>
                      <th className="p-4">Execution Status</th>
                      <th className="p-4">Diagnostic Output Log</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {runs.map((r) => (
                      <tr key={r.id} className="hover:bg-white/5 font-mono">
                        <td className="p-4 text-white/50 whitespace-nowrap">{r.started_at ? new Date(r.started_at).toLocaleString() : 'N/A'}</td>
                        <td className="p-4 text-white font-semibold">{r.automation ? r.automation.name : 'Unknown / Deleted'}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
                            ${r.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : r.status === 'running'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                              : r.status === 'skipped'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4 text-white/60 max-w-sm truncate" title={r.output_summary || r.error || ""}>
                          {r.output_summary || r.error || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. CREATE / EDIT AUTOMATION SCHEDULER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1002]">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-white/5 bg-slate-950/40 flex items-center justify-between shrink-0">
              <h3 className="text-md font-black text-white uppercase tracking-wider font-mono">{modalTitle}</h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAutomation} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-1">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Automation Label Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Personal Briefing Check"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Grid selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Agent Assignment */}
                <div>
                  <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Target AI Agent Responsibility:</label>
                  <select
                    value={formAgentId}
                    onChange={(e) => setFormAgentId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>{ag.name} ({ag.role})</option>
                    ))}
                    {agents.length === 0 && <option value="">No Agents Available</option>}
                  </select>
                </div>

                {/* Automation audit type */}
                <div>
                  <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Automation Business Type:</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="daily_briefing">Daily Briefing Audit</option>
                    <option value="end_day_review">End of Day Performance Review</option>
                    <option value="email_triage">Email Importance Triage</option>
                    <option value="task_review">Unresolved Task Review</option>
                    <option value="project_review">Stale Project Status Warning</option>
                    <option value="finance_review">Finance & Accounts Ledger Alert</option>
                    <option value="calendar_review">Upcoming Calendar Conflict Triage</option>
                    <option value="custom">Custom Agent Query Prompt</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Automation Functional Scope / Prompt:</label>
                <textarea
                  placeholder="Provide guidance or custom target instructions for the agent..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full h-16 px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Scheduler interval */}
              <div>
                <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Trigger Schedule Frequency:</label>
                <select
                  value={formScheduleType}
                  onChange={(e) => setFormScheduleType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="hourly">Hourly Intermittent Intervals</option>
                  <option value="daily">Daily Fixed Time Check</option>
                  <option value="weekly">Weekly Rotational Day</option>
                  <option value="monthly">Monthly Fixed Calendar Day</option>
                  <option value="manual">Manual Trigger Only (Paused)</option>
                </select>
              </div>

              {/* Interactive config fields */}
              {formScheduleType === 'hourly' && (
                <div>
                  <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Hour Frequency Repeat Step:</label>
                  <select
                    value={formIntervalHours}
                    onChange={(e) => setFormIntervalHours(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1">Trigger every 1 Hour</option>
                    <option value="2">Trigger every 2 Hours</option>
                    <option value="4">Trigger every 4 Hours</option>
                    <option value="8">Trigger every 8 Hours</option>
                    <option value="12">Trigger every 12 Hours</option>
                  </select>
                </div>
              )}

              {['daily', 'weekly', 'monthly'].includes(formScheduleType) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fixed schedule time */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Fixed Trigger Time (UTC format):</label>
                    <input
                      type="time"
                      required
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {formScheduleType === 'weekly' && (
                    <div>
                      <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Rotational Week Checkday:</label>
                      <select
                        value={formWeekday}
                        onChange={(e) => setFormWeekday(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="monday">Monday</option>
                        <option value="tuesday">Tuesday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="thursday">Thursday</option>
                        <option value="friday">Friday</option>
                        <option value="saturday">Saturday</option>
                        <option value="sunday">Sunday</option>
                      </select>
                    </div>
                  )}

                  {formScheduleType === 'monthly' && (
                    <div>
                      <label className="block text-[10px] font-bold text-white/45 uppercase tracking-widest mb-1.5">Fixed Calendar Monthday:</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={formMonthDay}
                        onChange={(e) => setFormMonthDay(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Status enabled toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="formEnabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="w-4 h-4 bg-slate-950 border-white/10 rounded focus:ring-indigo-500"
                />
                <label htmlFor="formEnabled" className="text-xs font-bold text-white/80 cursor-pointer">
                  Activate schedule and update Next Scheduled Run Immediately
                </label>
              </div>

              {/* Requires confirmation toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formRequiresConfirmation"
                  checked={formRequiresConfirmation}
                  onChange={(e) => setFormRequiresConfirmation(e.target.checked)}
                  className="w-4 h-4 bg-slate-950 border-white/10 rounded focus:ring-indigo-500"
                />
                <label htmlFor="formRequiresConfirmation" className="text-xs font-bold text-white/80 cursor-pointer">
                  Requires Manual Confirmation for Risky/Critical Actions
                </label>
              </div>

              {/* Footer controls button */}
              <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/10 transition-all font-mono"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. PROPOSED PARAMS MODAL VIEW */}
      {selectedPayload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1003]">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-slate-950/40 flex items-center justify-between shrink-0">
              <span className="text-xs font-black text-indigo-400 uppercase tracking-widest font-mono">Proposed Payload Schema Parameters</span>
              <button 
                onClick={() => setSelectedPayload(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <pre className="p-4 bg-slate-950 border border-white/5 rounded-2xl text-[11px] font-mono text-indigo-300 overflow-x-auto leading-relaxed max-h-[350px]">
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
              <div className="flex items-center justify-end pt-4 border-t border-white/5 mt-4">
                <button
                  onClick={() => setSelectedPayload(null)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[11px] font-mono font-bold uppercase tracking-widest rounded-xl transition-all"
                >
                  Close Parameters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
