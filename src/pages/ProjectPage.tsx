import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Target, 
  Plus, 
  Upload, 
  DollarSign, 
  CheckSquare, 
  Clock, 
  AlertCircle,
  Loader2,
  Package,
  FileText,
  Mail,
  TrendingUp,
  TrendingDown,
  Briefcase,
  User,
  Users,
  Trash2,
  Layout,
  StickyNote
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Project, Task, ProjectItem, ProjectFile, Email, Expense } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../hooks/useUser';
import ProjectItems from '../components/ProjectItems';
import ProjectFinance from '../components/ProjectFinance';
import ProjectFiles from '../components/ProjectFiles';
import ProjectTasks from '../components/ProjectTasks';
import ProjectEmails from '../components/ProjectEmails';
import ProjectExpenses from '../components/ProjectExpenses';
import ProjectNotes from '../components/ProjectNotes';

type TabType = 'overview' | 'items' | 'tasks' | 'files' | 'emails' | 'expenses' | 'notes' | 'contacts';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { showToast } = useUI();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [linkedContacts, setLinkedContacts] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [isLinkingContact, setIsLinkingContact] = useState(false);
  const [stats, setStats] = useState({
    openTasks: 0,
    completedTasks: 0,
    items: 0,
    files: 0,
    emails: 0,
    income: 0,
    expenses: 0,
    net: 0
  });

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const consumeAction = () => setPendingAction(null);

  const fetchProjectData = async () => {
    if (!projectId) return;
    setLoading(loading && !project); // only full loading if no project yet
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, business:businesses(name), platform:platforms(name)')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      setProject(data);

      // Fetch stats
      const [
        { count: openTasks },
        { count: completedTasks },
        { count: items },
        { count: files },
        { data: directEmails },
        { data: linkedEmailIds },
        { data: directExpenses },
        { data: linkedExpenses }
      ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', projectId).neq('status', 'done'),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'done'),
        supabase.from('project_items').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('project_files').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        // Emails
        supabase.from('emails').select('id').eq('linked_project_id', projectId),
        supabase.from('email_project_links').select('email_id').eq('project_id', projectId),
        // Expenses
        supabase.from('expenses').select('id, amount, direction').eq('project_id', projectId),
        supabase.from('expense_project_links').select('expense_id, expense:expenses(id, amount, direction)').eq('project_id', projectId)
      ]);

      // Deduplicate emails
      const emailIds = new Set([
        ...(directEmails?.map(e => e.id) || []),
        ...(linkedEmailIds?.map(l => l.email_id) || [])
      ]);

      // Deduplicate expenses (careful with multi-link)
      const expenseMap = new Map<string, { amount: number, direction: string }>();
      
      directExpenses?.forEach(e => {
        expenseMap.set(e.id, { amount: e.amount, direction: e.direction });
      });
      
      linkedExpenses?.forEach(l => {
        if (l.expense) {
          expenseMap.set((l.expense as any).id, { 
            amount: (l.expense as any).amount, 
            direction: (l.expense as any).direction 
          });
        }
      });

      const expenseList = Array.from(expenseMap.values());
      const income = expenseList.filter(e => e.direction === 'in').reduce((sum, e) => sum + e.amount, 0);
      const expenses = expenseList.filter(e => e.direction === 'out').reduce((sum, e) => sum + e.amount, 0);

      setStats({
        openTasks: openTasks || 0,
        completedTasks: completedTasks || 0,
        items: items || 0,
        files: files || 0,
        emails: emailIds.size,
        income,
        expenses,
        net: income - expenses
      });

      // Fetch direct contact links for project
      const { data: contactsData, error: contactsErr } = await supabase
        .from('contact_project_links')
        .select('*, contact:phonebook_contacts(*)')
        .eq('project_id', projectId);
      if (contactsErr) {
        console.warn('Failed to fetch project contacts:', contactsErr);
      } else {
        setLinkedContacts(contactsData || []);
      }

      // Fetch all phonebook contacts for link selection
      const { data: allContactsData } = await supabase
        .from('phonebook_contacts')
        .select('id, name, email, company_name')
        .order('name');
      setAllContacts(allContactsData || []);

    } catch (err: any) {
      showToast.error("Failed to load project: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContactLink = async (contactId: string, relationshipType: string = '', notes: string = '') => {
    if (!projectId || !contactId) return;
    try {
      const { error } = await supabase
        .from('contact_project_links')
        .insert({
          user_id: user?.id,
          contact_id: contactId,
          project_id: projectId,
          relationship_type: relationshipType || null,
          notes: notes || null
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('This contact is already linked to this project');
        }
        throw error;
      }
      showToast.success('Contact added to project');
      fetchProjectData();
    } catch (err: any) {
      showToast.error('Failed to link contact: ' + err.message);
    }
  };

  const handleRemoveContactLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('contact_project_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      showToast.success('Contact unlinked successfully');
      fetchProjectData();
    } catch (err: any) {
      showToast.error('Failed to remove contact link: ' + err.message);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  if (loading && !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Loading Workspace...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertCircle size={40} />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Project Not Found</h3>
          <p className="text-sm text-white/40 mt-2">The project you are looking for does not exist or you don't have access.</p>
        </div>
        <Link 
          to="/projects"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest"
        >
          <ArrowLeft size={16} /> Back to Projects
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    planning: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    in_progress: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    on_hold: 'text-red-400 bg-red-400/10 border-red-400/20',
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
    cancelled: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  };

  const priorityColors: Record<string, string> = {
    urgent: 'text-red-400 bg-red-400/10 border-red-400/20',
    high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    medium: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    low: 'text-white/40 bg-white/5 border-white/5',
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Layout },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'files', label: 'Files', icon: FileText },
    { id: 'emails', label: 'Emails', icon: Mail },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'contacts', label: 'Contacts', icon: Users },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button 
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 group text-white/40 hover:text-white transition-colors self-start"
          >
            <div className="p-2 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-all">
              <ArrowLeft size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Projects</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button 
              onClick={() => { setActiveTab('tasks'); setPendingAction('create_task'); }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest min-h-[40px]"
            >
              <Plus size={13} /> Add Task
            </button>
            <button 
              onClick={() => { setActiveTab('items'); setPendingAction('create_item'); }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest min-h-[40px]"
            >
              <Plus size={13} /> Add Item
            </button>
            <button 
              onClick={() => { setActiveTab('files'); setPendingAction('upload_file'); }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest min-h-[40px]"
            >
              <Upload size={13} /> Upload
            </button>
            <button 
              onClick={() => { setActiveTab('expenses'); setPendingAction('create_expense'); }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest min-h-[40px]"
            >
              <DollarSign size={13} /> Expense
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 w-full lg:max-w-2xl">
            <div className="flex flex-col sm:flex-row sm:items-start md:items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/10 w-fit shrink-0">
                <Target size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white uppercase tracking-tight leading-tight break-words">{project.name}</h1>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border", statusColors[project.status])}>
                      {project.status.replace('_', ' ')}
                    </span>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border", priorityColors[project.priority])}>
                      {project.priority}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <div className="flex items-center gap-1 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                    <Briefcase size={11} />
                    {project.business?.name || 'Independent'}
                  </div>
                  <span className="w-1 h-1 rounded-full bg-white/10 hidden sm:inline" />
                  <div className={cn(
                    "flex items-center gap-1 text-[10px] font-black uppercase tracking-widest",
                    project.category === 'personal' ? 'text-emerald-400' : 'text-purple-400'
                  )}>
                    <User size={11} />
                    {project.category || 'Standard'}
                  </div>
                  {project.platform && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/10 hidden sm:inline" />
                      <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                        {project.platform.name}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row sm:flex-col lg:items-end justify-between items-center sm:text-right gap-4 w-full lg:w-auto mt-4 lg:mt-0 border-t border-white/5 pt-4 lg:border-t-0 lg:pt-0">
            {project.deadline && (
              <div className="flex flex-col lg:items-end text-left sm:text-right">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-0.5">Deadline</span>
                <span className="text-sm font-bold text-orange-400">{new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
            <div className="w-full max-w-[200px] sm:max-w-[240px] space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Progress</span>
                <span className="text-[9px] font-bold text-white/60">{project.progress || 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${project.progress || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <CheckSquare size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-blue-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Open Tasks</p>
          <p className="text-2xl font-bold text-white">{stats.openTasks}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <CheckSquare size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-emerald-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Done</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.completedTasks}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <Package size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-amber-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Items</p>
          <p className="text-2xl font-bold text-white">{stats.items}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <FileText size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-emerald-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Files</p>
          <p className="text-2xl font-bold text-white">{stats.files}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <Mail size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-purple-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Emails</p>
          <p className="text-2xl font-bold text-white">{stats.emails}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <TrendingUp size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-emerald-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Income</p>
          <p className="text-lg font-bold text-emerald-400">${stats.income.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <TrendingDown size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-red-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Burn</p>
          <p className="text-lg font-bold text-red-400">${stats.expenses.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden relative group">
          <DollarSign size={40} className="absolute -right-2 -bottom-2 text-white/[0.03] group-hover:text-blue-500/10 transition-colors" />
          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Net</p>
          <p className={cn("text-lg font-black", stats.net >= 0 ? "text-emerald-400" : "text-red-400 underline decoration-red-400/20")}>
            ${stats.net.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Primary Workspace Navigation */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/5 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPendingAction(null); }}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white text-slate-950 shadow-xl" 
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[500px]">
        {activeTab === 'overview' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div>
                  <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Project Description</h4>
                  <p className="text-base text-white/70 leading-relaxed bg-white/5 border border-white/5 p-4 sm:p-8 rounded-[2.5rem] shadow-2xl">
                    {project.description || 'No description provided.'}
                  </p>
                </div>
                {project.ai_summary && (
                  <div>
                    <h4 className="text-[10px] font-black text-blue-400/40 uppercase tracking-[0.3em] mb-4">AI Project Intelligence</h4>
                    <div className="p-4 sm:p-8 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 text-base text-blue-200/80 leading-relaxed italic shadow-2xl shadow-blue-500/5">
                      {project.ai_summary}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 shadow-xl">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Financial Budget</p>
                    <p className="text-2xl font-bold text-white">${project.budget?.toLocaleString() || '0'}</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 shadow-xl">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Next Action Point</p>
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-tight line-clamp-1">{project.next_action || 'None Defined'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <ProjectFinance project={project} />
                {project.notes && activeTab === 'overview' && (
                  <div>
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Legacy Notes</h4>
                    <div className="p-4 sm:p-8 rounded-[2.5rem] bg-black/20 border border-white/5 text-xs text-white/50 font-mono whitespace-pre-wrap leading-[2] shadow-inner max-h-[300px] overflow-y-auto">
                      {project.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <ProjectItems 
            project={project} 
            onUpdate={fetchProjectData} 
            createSignal={pendingAction === 'create_item' ? 1 : 0} 
            onActionConsumed={consumeAction}
          />
        )}

        {activeTab === 'tasks' && (
          <ProjectTasks 
            project={project} 
            onUpdate={fetchProjectData} 
            createSignal={pendingAction === 'create_task' ? 1 : 0} 
            onActionConsumed={consumeAction}
          />
        )}

        {activeTab === 'files' && (
          <ProjectFiles 
            project={project} 
            onUpdate={fetchProjectData} 
            uploadSignal={pendingAction === 'upload_file' ? 1 : 0} 
            onActionConsumed={consumeAction}
          />
        )}

        {activeTab === 'emails' && (
          <ProjectEmails project={project} />
        )}

        {activeTab === 'expenses' && (
          <ProjectExpenses 
            project={project} 
            onUpdate={fetchProjectData} 
            createSignal={pendingAction === 'create_expense' ? 1 : 0} 
            onActionConsumed={consumeAction}
          />
        )}

        {activeTab === 'notes' && (
          <ProjectNotes project={project} />
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Project Contact Relationships</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Assign, edit roles, or see linked stakeholders for this project</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkingContact(!isLinkingContact)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
              >
                {isLinkingContact ? 'Cancel' : 'Add Contact Link'}
              </button>
            </div>

            {isLinkingContact && (
              <ProjectContactLinkCreator
                allContacts={allContacts}
                existingLinkedIds={linkedContacts.map(lc => lc.contact_id)}
                onSave={async (contactId, relType, notes) => {
                  await handleAddContactLink(contactId, relType, notes);
                  setIsLinkingContact(false);
                }}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {linkedContacts.map(link => {
                const cnt = link.contact;
                if (!cnt) return null;
                return (
                  <div 
                    key={link.id} 
                    className="group relative bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-purple-500/20 transition-all hover:bg-white/[0.08]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                          <Users size={20} />
                        </div>
                        <div>
                          <Link to={`/phonebook/${cnt.id}`} className="text-xs font-black text-white uppercase tracking-tight hover:underline">{cnt.name}</Link>
                          {cnt.company_name && (
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">{cnt.company_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContactLink(link.id)}
                        className="p-2 rounded-xl text-red-500/40 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove Link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {link.relationship_type && (
                      <div className="mb-3">
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/10 text-[9px] font-black text-purple-400 uppercase tracking-widest inline-block">
                          Role: {link.relationship_type}
                        </span>
                      </div>
                    )}

                    {link.notes && (
                      <div className="pt-3 border-t border-white/5 mt-3">
                        <div className="text-[10px] text-white/50 lowercase leading-relaxed">
                          <span className="font-bold uppercase text-[9px] tracking-wider block text-white/30 mb-1">Relationship Notes:</span>
                          {link.notes}
                        </div>
                      </div>
                    )}

                    {cnt.email && (
                      <div className="flex items-center gap-1.5 mt-4 text-[10px] text-white/30 font-semibold uppercase tracking-wider truncate">
                        <Mail size={12} />
                        {cnt.email}
                      </div>
                    )}
                  </div>
                );
              })}

              {linkedContacts.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/10 text-center">
                  <Users size={36} className="text-white/25 mb-3" />
                  <p className="text-xs font-black uppercase text-white/40 tracking-[0.3em]">No contacts linked to this project</p>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Directly map key contacts, stakeholders, or managers to this project record</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProjectContactLinkCreatorProps {
  allContacts: any[];
  existingLinkedIds: string[];
  onSave: (contactId: string, relationshipType: string, notes: string) => Promise<void>;
}

function ProjectContactLinkCreator({ allContacts, existingLinkedIds, onSave }: ProjectContactLinkCreatorProps) {
  const [contactId, setContactId] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const availableContacts = allContacts.filter(c => !existingLinkedIds.includes(c.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;
    setLoading(true);
    await onSave(contactId, relationshipType, notes);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 max-w-xl">
      <h4 className="text-xs font-black uppercase text-purple-400 tracking-[0.2em]">Add Contact Partnership</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">Select Contact</label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            required
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-purple-500 outline-none"
          >
            <option value="">Choose Contact...</option>
            {availableContacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">Project Role / Connection</label>
          <input
            type="text"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            placeholder="e.g. Lead Developer, Subject Contact"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-purple-500 outline-none"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">Relationship Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter relevant instructions or details..."
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-purple-500 outline-none min-h-[70px]"
        />
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!contactId || loading}
          className="px-6 py-2.5 rounded-xl bg-white text-slate-950 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? 'Creating Link...' : 'Establish connection'}
        </button>
      </div>
    </form>
  );
}
