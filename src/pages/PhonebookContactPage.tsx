import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  Edit2, 
  Trash2, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  AlertCircle,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layout,
  FileText,
  Briefcase,
  ExternalLink,
  Target,
  Plus,
  CheckSquare,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { PhonebookContact, Business, Expense, Email, Project, FinancialAccount } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../hooks/useUser';
import CreateModal from '../components/CreateModal';

type TabType = 'overview' | 'expenses' | 'emails' | 'projects' | 'tasks' | 'notes';

export default function PhonebookContactPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { confirm, showToast } = useUI();

  const [contact, setContact] = useState<PhonebookContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkedProjectLinks, setLinkedProjectLinks] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isLinkingProject, setIsLinkingProject] = useState(false);

  const fetchContactData = async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      // Fetch contact
      const { data: contactData, error: contactError } = await supabase
        .from('phonebook_contacts')
        .select('*, business:businesses(id, name)')
        .eq('id', contactId)
        .single();
      
      if (contactError) throw contactError;
      setContact(contactData);

      // Fetch direct contact-project links
      const { data: directLinks, error: linksError } = await supabase
        .from('contact_project_links')
        .select('*, project:projects(id, name, status, business_id)')
        .eq('contact_id', contactId);
        
      if (linksError) {
        console.warn('Failed to load contact-project links:', linksError);
      } else {
        setLinkedProjectLinks(directLinks || []);
      }

      // Fetch expenses
      const { data: expenseData } = await supabase
  .from('expenses')
  .select('*, account:financial_accounts(name), project:projects(id, name, status)')
  .eq('counterparty_contact_id', contactId)
  .order('expense_date', { ascending: false });
      
      setExpenses(expenseData || []);

      // Derive projects from expenses
      const projectMap = new Map<string, any>();
expenseData?.forEach((exp: any) => {
  if (exp.project?.id) {
    projectMap.set(exp.project.id, exp.project);
  }
});
setProjects(Array.from(projectMap.values()) as Project[]);

      // Fetch emails if email exists
      if (contactData.email) {
        // Safer approach with two queries to avoid potential search syntax issues in some providers
        const [{ data: sentEmails }, { data: rcvEmails }] = await Promise.all([
          supabase.from('emails').select('*, account:email_accounts(id, email_address, display_color, display_name)').ilike('sender', `%${contactData.email}%`),
          supabase.from('emails').select('*, account:email_accounts(id, email_address, display_color, display_name)').ilike('recipient', `%${contactData.email}%`)
        ]);

        const combined = [...(sentEmails || []), ...(rcvEmails || [])];
        const deduped = Array.from(new Map(combined.map(e => [e.id, e])).values());
        setEmails(deduped.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()));
      } else {
        setEmails([]);
      }

      // Fetch tasks linked via markers in notes
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*, project:projects(id, name)')
        .ilike('notes', `%Contact ID: ${contactId}%`)
        .order('created_at', { ascending: false });
      
      setTasks(taskData || []);

      // Fetch businesses for dropdown
      const { data: businessData } = await supabase.from('businesses').select('id, name').order('name');
      setBusinesses(businessData || []);

      // Fetch all projects for selectors
      const { data: allProjectsData } = await supabase
        .from('projects')
        .select('id, name, business_id')
        .order('name');
      setAllProjects((allProjectsData || []) as Project[]);

      // Fetch financial accounts
const { data: accountsData, error: accountsError } = await supabase
  .from('financial_accounts')
  .select('id, name, currency, parent_id, account_type, status')
  .or('status.eq.active,status.is.null')
  .order('name');

if (accountsError) throw accountsError;
setFinancialAccounts((accountsData || []) as any[]);

    } catch (err: any) {
      showToast.error("Failed to load contact: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactData();
  }, [contactId]);

  const handleEditSubmit = async (data: any) => {
    if (!user || !contact) return;
    try {
      let metadata = null;
      if (data.metadata && typeof data.metadata === 'string' && data.metadata.trim()) {
        try {
          metadata = JSON.parse(data.metadata);
        } catch (e) {
          throw new Error('Invalid Metadata JSON format');
        }
      } else if (data.metadata && typeof data.metadata === 'object') {
        metadata = data.metadata;
      }

      const sanitizeValue = (val: any) => val && val.trim() !== '' ? val.trim() : null;
      const sanitizeUuid = (id: any) => id && id.trim() !== '' && id !== 'none' ? id : null;
      
      const updateData = {
        name: data.name?.trim(),
        email: sanitizeValue(data.email),
        phone: sanitizeValue(data.phone),
        website_url: sanitizeValue(data.website_url),
        tax_id: sanitizeValue(data.tax_id),
        address: sanitizeValue(data.address),
        company_name: sanitizeValue(data.company_name),
        contact_type: data.contact_type || 'other',
        business_id: sanitizeUuid(data.business_id),
        metadata: metadata || {},
        notes: sanitizeValue(data.notes),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('phonebook_contacts')
        .update(updateData)
        .eq('id', contact.id);
      
      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'contact',
        entity_id: contact.id,
        details: { name: updateData.name }
      });

      setIsEditModalOpen(false);
      showToast.success("Contact updated successfully");
      fetchContactData();
    } catch (err: any) {
      showToast.error("Update failed: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    const isConfirmed = await confirm({
      title: 'Delete Contact',
      message: `Are you sure you want to delete ${contact.name}? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('phonebook_contacts').delete().eq('id', contact.id);
      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'delete',
        entity_type: 'contact',
        entity_id: contact.id,
        details: { name: contact.name }
      });

      showToast.success("Contact deleted");
      navigate('/phonebook');
    } catch (err: any) {
      showToast.error("Delete failed: " + err.message);
    }
  };

  const handleAddProjectLink = async (projectId: string, relationshipType: string = '', notes: string = '') => {
    if (!contactId || !projectId) return;
    try {
      const { data: userSession } = await supabase.auth.getUser();
      if (!userSession.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('contact_project_links')
        .insert({
          user_id: userSession.user.id,
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
      showToast.success('Contact linked successfully to project');
      fetchContactData();
    } catch (err: any) {
      showToast.error('Failed to link project: ' + err.message);
    }
  };

  const handleRemoveProjectLink = async (linkId: string) => {
    const isConfirmed = await confirm({
      title: 'Remove Project Link',
      message: 'Are you sure you want to decouple this contact from the project?',
      confirmLabel: 'Remove Link',
      isDestructive: true
    });
    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('contact_project_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      showToast.success('Association removed successfully');
      fetchContactData();
    } catch (err: any) {
      showToast.error('Failed to remove link: ' + err.message);
    }
  };

  const handleExpenseSubmit = async (data: any, direction: 'in' | 'out') => {
    if (!user || !contact) return;

    try {
      const amount = Number(data.amount);
      if (!data.title?.trim()) throw new Error('Transaction title is required.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter a valid positive amount.');

      let metadata = {};
      if (data.metadata && String(data.metadata).trim()) {
        try {
          metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
        } catch (e) {
          throw new Error('Invalid Metadata JSON format');
        }
      }

      const status = data.status || 'pending';
      let settledAt = null;
      if (direction === 'out' && (status === 'paid' || status === 'settled')) {
        settledAt = new Date().toISOString();
      } else if (direction === 'in' && (status === 'received' || status === 'settled')) {
        settledAt = new Date().toISOString();
      }

      const payload = {
        user_id: user.id,
        direction,
        title: data.title.trim(),
        amount,
        currency: data.currency || 'USD',
        business_id: data.business_id && data.business_id !== 'none' ? data.business_id : null,
        project_id: data.project_id && data.project_id !== 'none' ? data.project_id : null,
        financial_account_id: data.financial_account_id || null,
        counterparty_contact_id: contact.id,
        category: data.category?.trim() || null,
        payment_type: data.payment_type?.trim() || (data.financial_account_id ? 'bank_transfer' : 'cash'),
        expense_date: data.expense_date || new Date().toISOString().split('T')[0],
        status,
        notes: data.notes?.trim() || null,
        metadata,
        settled_at: settledAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newExp, error } = await supabase.from('expenses').insert(payload).select().single();
      if (error) throw error;

      showToast.success(`${direction === 'in' ? 'Income' : 'Expense'} recorded`);
      setIsExpenseModalOpen(false);
      setIsIncomeModalOpen(false);
      fetchContactData();
    } catch (err: any) {
      showToast.error("Failed to save transaction: " + err.message);
    }
  };

  const handleTaskSubmit = async (data: any) => {
    if (!user || !contact) return;

    try {
      if (!data.title?.trim()) throw new Error('Task title is required.');

      const contactContext = `Related contact: ${contact.name}\nContact ID: ${contact.id}\nEmail: ${contact.email || 'N/A'}\nPhone: ${contact.phone || 'N/A'}\n\n`;
      const notes = contactContext + (data.notes || '');

      const payload = {
        user_id: user.id,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        business_id: data.business_id && data.business_id !== 'none' ? data.business_id : null,
        project_id: data.project_id && data.project_id !== 'none' ? data.project_id : null,
        priority: data.priority || 'medium',
        status: data.status || 'today',
        due_date: data.due_date || null,
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('tasks').insert(payload);
      if (error) throw error;

      showToast.success("Task created");
      setIsTaskModalOpen(false);
      fetchContactData();
    } catch (err: any) {
      showToast.error("Failed to create task: " + err.message);
    }
  };

  const handleNotesQuickUpdate = async (data: any) => {
    if (!user || !contact) return;
    try {
      const { error } = await supabase
        .from('phonebook_contacts')
        .update({ 
          notes: data.notes,
          updated_at: new Date().toISOString() 
        })
        .eq('id', contact.id);
      
      if (error) throw error;
      showToast.success("Notes updated");
      setIsNotesModalOpen(false);
      fetchContactData();
    } catch (err: any) {
      showToast.error("Failed to update notes: " + err.message);
    }
  };

  if (loading && !contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Loading Entity...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertCircle size={40} />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Contact Not Found</h3>
          <p className="text-sm text-white/40 mt-2">This contact does not exist or has been removed.</p>
        </div>
        <Link 
          to="/phonebook"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest"
        >
          <ArrowLeft size={16} /> Back to Phonebook
        </Link>
      </div>
    );
  }

  const income = expenses.filter(e => e.direction === 'in').reduce((sum, e) => sum + e.amount, 0);
  const outgo = expenses.filter(e => e.direction === 'out').reduce((sum, e) => sum + e.amount, 0);

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Layout },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'emails', label: 'Emails', icon: Mail },
    { id: 'projects', label: 'Projects', icon: Target },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'notes', label: 'Notes', icon: FileText },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/phonebook')}
            className="flex items-center gap-2 group text-white/40 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-all">
              <ArrowLeft size={16} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Phonebook</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
            >
              <Edit2 size={14} /> Edit
            </button>
            <button 
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all font-black text-[10px] uppercase tracking-widest"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-700 p-0.5 shadow-2xl shadow-blue-500/20">
              <div className="w-full h-full rounded-[1.85rem] bg-slate-950 flex items-center justify-center text-3xl font-black text-white/90">
                {(contact.name || contact.company_name || '?').charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold text-white uppercase tracking-tight">{contact.name}</h1>
                <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  {contact.contact_type}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {contact.company_name && (
                  <div className="flex items-center gap-1.5 text-white/40 text-xs font-bold uppercase tracking-tight">
                    <Building2 size={14} />
                    {contact.company_name}
                  </div>
                )}
                {contact.business && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <div className="flex items-center gap-1.5 text-emerald-400/60 text-[10px] font-black uppercase tracking-widest">
                      <Briefcase size={12} />
                      {contact.business.name}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Lifetime Income</p>
              <p className="text-xl font-bold text-emerald-400">${income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Lifetime Billing</p>
              <p className="text-xl font-bold text-red-400">${outgo.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Net Balance</p>
              <p className={cn("text-xl font-black", (income - outgo) >= 0 ? "text-white" : "text-orange-400")}>
                ${(income - outgo).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={() => setIsExpenseModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all font-black text-[10px] uppercase tracking-widest"
        >
          <TrendingDown size={14} /> Add Expense
        </button>
        <button 
          onClick={() => setIsIncomeModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-black text-[10px] uppercase tracking-widest"
        >
          <TrendingUp size={14} /> Add Income
        </button>
        <button 
          onClick={() => setIsTaskModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-all font-black text-[10px] uppercase tracking-widest"
        >
          <CheckSquare size={14} /> Add Task
        </button>
        <button 
          onClick={() => setIsNotesModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all font-black text-[10px] uppercase tracking-widest"
        >
          <FileText size={14} /> Quick Note
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 border border-white/5 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
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

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-6">
                <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-4">Core Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Email Address</p>
                    <div className="flex items-center gap-2 text-white/80">
                      <Mail size={14} className="text-blue-500" />
                      <span className="text-sm">{contact.email || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Phone Number</p>
                    <div className="flex items-center gap-2 text-white/80">
                      <Phone size={14} className="text-blue-500" />
                      <span className="text-sm">{contact.phone || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Website</p>
                    <div className="flex items-center gap-2 text-white/80">
                      <Globe size={14} className="text-blue-500" />
                      {contact.website_url ? (
                        <a href={contact.website_url.startsWith('http') ? contact.website_url : `https://${contact.website_url}`} target="_blank" rel="noreferrer" className="text-sm hover:text-blue-400 flex items-center gap-1 transition-colors">
                          {contact.website_url} <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-sm">Not specified</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Tax ID / VAT</p>
                    <div className="flex items-center gap-2 text-white/80">
                      <FileText size={14} className="text-blue-500" />
                      <span className="text-sm font-mono tracking-wider">{contact.tax_id || 'Not registered'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pt-6 border-t border-white/5">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Physical Address</p>
                  <div className="flex items-start gap-2 text-white/80 mt-2">
                    <MapPin size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed whitespace-pre-wrap">{contact.address || 'No address provided'}</span>
                  </div>
                </div>
              </div>

              {contact.metadata && Object.keys(contact.metadata).length > 0 && (
                <div className="bg-white/5 border border-white/5 rounded-3xl p-8">
                  <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Technical Metadata</h3>
                  <pre className="text-[10px] font-mono text-blue-400/60 bg-black/40 border border-white/5 p-4 rounded-xl overflow-x-auto">
                    {JSON.stringify(contact.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 h-full">
                <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em] mb-6">Contact Notes</h3>
                <div className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap italic">
                  {contact.notes || "No internal notes have been recorded for this contact."}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Financial Records</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Income: ${income.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown size={14} className="text-red-400" />
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Expenses: ${outgo.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {expenses.map(expense => (
                <div key={expense.id} className="group flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl border",
                      expense.direction === 'in' ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-red-400 bg-red-400/10 border-red-400/20"
                    )}>
                      {expense.direction === 'in' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-tight">{expense.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{new Date(expense.expense_date).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{expense.account?.name || 'Manual Cash'}</span>
                        {expense.project && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Project: {expense.project.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-lg font-black tracking-tight", expense.direction === 'in' ? "text-emerald-400" : "text-red-400")}>
                      {expense.direction === 'in' ? '+' : '-'}${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">{expense.status}</p>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] opacity-20">
                  <DollarSign size={48} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.4em]">No financial transactions</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Communication History</h3>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Linked by: {contact.email}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {emails.map(email => (
                <div key={email.id} className="group flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/20">
                      <Mail size={18} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white uppercase tracking-tight line-clamp-1">{email.subject}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{new Date(email.received_at).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span className="text-[9px] font-black text-white/40 tracking-widest">{email.sender}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">{email.status}</span>
                    </div>
                    <Link to="/emails" className="p-2 text-blue-500/40 hover:text-blue-500 transition-colors">
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              ))}
              {emails.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] opacity-20">
                  <Mail size={48} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.4em]">No matching emails found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Direct Project Relationships</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Manage project assignments, team roles, or customer contracts</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkingProject(!isLinkingProject)}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
              >
                {isLinkingProject ? 'Cancel' : 'Link to Project'}
              </button>
            </div>

            {isLinkingProject && (
              <ProjectLinkCreatorForm
                allProjects={allProjects}
                existingLinkedIds={linkedProjectLinks.map(l => l.project_id)}
                onSave={async (projId, relType, notes) => {
                  await handleAddProjectLink(projId, relType, notes);
                  setIsLinkingProject(false);
                }}
              />
            )}

            {/* List directly linked projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {linkedProjectLinks.map(link => {
                const proj = link.project;
                if (!proj) return null;
                return (
                  <div 
                    key={link.id} 
                    className="group relative bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-purple-500/20 transition-all hover:bg-white/[0.08]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                          <Target size={24} />
                        </div>
                        <div>
                          <Link to={`/projects/${proj.id}`} className="text-sm font-black text-white uppercase tracking-tight hover:underline">{proj.name}</Link>
                          {link.relationship_type && (
                            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mt-0.5">{link.relationship_type}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProjectLink(link.id)}
                        className="p-2 rounded-xl text-red-500/40 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove Link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {link.notes && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="text-[10px] text-white/50 lowercase leading-relaxed line-clamp-3">
                          <span className="font-bold uppercase text-[9px] tracking-wider block text-white/30 mb-1">Relationship Notes:</span>
                          {link.notes}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-4">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">{proj.status}</span>
                    </div>
                  </div>
                );
              })}

              {linkedProjectLinks.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/10">
                  <Target size={36} className="text-white/20 mb-3" />
                  <p className="text-xs font-black uppercase text-white/40 tracking-[0.3em]">No directly linked projects</p>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">Click top right link to assign this contact to a project</p>
                </div>
              )}
            </div>

            {/* billing history fallback projects if any */}
            {projects.length > 0 && (
              <div className="pt-8 border-t border-white/5">
                <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Implicit Project Billing Linkages</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                  {projects.filter(p => !linkedProjectLinks.some(l => l.project_id === p.id)).map(project => (
                    <Link 
                      key={project.id} 
                      to={`/projects/${project.id}`}
                      className="group bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-blue-500/20 transition-all hover:bg-white/[0.08]"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                          <Target size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{project.name}</h4>
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-0.5">Linked via invoices</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">{project.status}</span>
                      </div>
                    </Link>
                  ))}
                  {projects.filter(p => !linkedProjectLinks.some(l => l.project_id === p.id)).length === 0 && (
                    <p className="text-[9px] text-white/20 uppercase tracking-widest italic col-span-full">All transactional linkages are represented above</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Related Tasks</h3>
            <div className="grid grid-cols-1 gap-3">
              {tasks.map(task => (
                <div key={task.id} className="group p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl border capitalize text-[9px] font-black tracking-widest",
                        task.priority === 'urgent' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                        task.priority === 'high' ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                        "bg-white/5 border-white/10 text-white/40"
                      )}>
                        {task.priority}
                      </div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-tight">{task.title}</h4>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-white/5 text-[8px] font-black text-white/40 uppercase tracking-widest border border-white/5">
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  {(task.description || task.project) && (
                    <div className="flex items-center gap-4 mt-2">
                       {task.project && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-widest">
                          <Target size={12} />
                          {task.project.name}
                        </div>
                      )}
                      {task.due_date && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-white/30 uppercase tracking-widest">
                          <CalendarIcon size={12} />
                          {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                  {task.description && (
                    <p className="text-xs text-white/40 mt-2 line-clamp-2 italic">{task.description}</p>
                  )}
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] opacity-20">
                  <CheckSquare size={48} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.4em]">No related tasks</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6 h-full">
            <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Internal Knowledge Base</h3>
            <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 min-h-[300px]">
              <div className="flex items-start gap-4 text-white/70 italic leading-[2] text-sm">
                <FileText className="shrink-0 text-blue-500/40" size={20} />
                <div className="whitespace-pre-wrap">
                  {contact.notes || "No extended notes are currently logged. Consider adding strategic context, background history, or relationship objectives in the edit contact form."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Contact"
        mode="edit"
        onSubmit={handleEditSubmit}
        initialValues={contact}
        fields={[
          {
            name: 'name',
            label: 'Full Name',
            type: 'text',
            placeholder: 'e.g. John Smith'
          },
          {
            name: 'contact_type',
            label: 'Contact Type',
            type: 'select',
            options: [
              'client', 'supplier', 'contractor', 'partner', 'bank', 
              'developer', 'employee', 'marketplace', 'government', 'other'
            ].map(t => ({ label: t.toUpperCase(), value: t }))
          },
          {
            name: 'company_name',
            label: 'Company Name',
            type: 'text',
            placeholder: 'Optional company name'
          },
          {
            name: 'email',
            label: 'Email Address',
            type: 'text',
            placeholder: 'email@example.com'
          },
          {
            name: 'phone',
            label: 'Phone Number',
            type: 'text',
            placeholder: '+1 ...'
          },
          {
            name: 'website_url',
            label: 'Website URL',
            type: 'text',
            placeholder: 'https://...'
          },
          {
            name: 'tax_id',
            label: 'Tax ID / VAT',
            type: 'text',
            placeholder: 'Business tax ID'
          },
          {
            name: 'address',
            label: 'Physical Address',
            type: 'textarea'
          },
          {
            name: 'business_id',
            label: 'Primary Business Link',
            type: 'select',
            options: [
              { label: 'NO BUSINESS LINK', value: 'none' },
              ...(businesses?.map(b => ({ label: b.name.toUpperCase(), value: b.id })) || [])
            ]
          },
          {
            name: 'notes',
            label: 'Internal Notes',
            type: 'textarea'
          },
          {
            name: 'metadata',
            label: 'Metadata (JSON)',
            type: 'textarea',
            placeholder: '{"key": "value"}'
          }
        ]}
      />

      {/* Quick Action Modals */}
      <CreateModal
        isOpen={isExpenseModalOpen || isIncomeModalOpen}
        onClose={() => { setIsExpenseModalOpen(false); setIsIncomeModalOpen(false); }}
        title={isExpenseModalOpen ? "Add Expense" : "Add Income"}
        mode="create"
        onSubmit={(data) => handleExpenseSubmit(data, isExpenseModalOpen ? 'out' : 'in')}
        initialValues={{
          currency: 'USD',
          expense_date: new Date().toISOString().split('T')[0],
          status: 'pending',
          business_id: contact?.business_id || 'none'
        }}
        fields={[
          { name: 'title', label: 'Transaction Title', type: 'text', placeholder: 'e.g. Consulting Fee' },
          { name: 'amount', label: 'Amount', type: 'number' },
          { 
            name: 'currency', 
            label: 'Currency', 
            type: 'select', 
            options: ['USD', 'EUR', 'MXN', 'GBP'].map(c => ({ label: c, value: c }))
          },
          {
            name: 'business_id',
            label: 'Business',
            type: 'select',
            options: [
              { label: 'NO BUSINESS', value: 'none' },
              ...businesses.map(b => ({ label: b.name.toUpperCase(), value: b.id }))
            ]
          },
          {
            name: 'project_id',
            label: 'Project Link',
            type: 'select',
            options: [
              { label: 'NO PROJECT', value: 'none' },
              ...allProjects.map(p => ({ label: p.name.toUpperCase(), value: p.id }))
            ]
          },
          {
            name: 'financial_account_id',
            label: 'Payment Account',
            type: 'select',
            options: [
              { label: 'CASH / MANUAL', value: '' },
              ...financialAccounts.map(a => {
                const parent = (a as any).parent_id ? financialAccounts.find(p => p.id === (a as any).parent_id) : null;
                const label = parent ? `${parent.name.toUpperCase()} > ${a.name.toUpperCase()} (${a.currency})` : `${a.name.toUpperCase()} (${a.currency})`;
                return { label, value: a.id };
              })
            ]
          },
          { 
            name: 'payment_type', 
            label: 'Payment Method', 
            type: 'select',
            defaultValue: 'cash',
            options: [
              { label: 'CASH', value: 'cash' },
              { label: 'BANK TRANSFER', value: 'bank_transfer' },
              { label: 'DEBIT CARD', value: 'debit_card' },
              { label: 'CREDIT CARD', value: 'credit_card' },
              { label: 'PAYPAL', value: 'paypal' },
              { label: 'STRIPE', value: 'stripe' },
              { label: 'WISE', value: 'wise' },
              { label: 'ZELLE', value: 'zelle' },
              { label: 'CHECK', value: 'check' },
              { label: 'CRYPTO', value: 'crypto' },
              { label: 'OTHER', value: 'other' }
            ]
          },
          { name: 'expense_date', label: 'Date', type: 'date' },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select', 
            options: isExpenseModalOpen ? [
              { label: 'PENDING', value: 'pending' },
              { label: 'PAID (SETTLED)', value: 'paid' },
              { label: 'CANCELLED', value: 'cancelled' }
            ] : [
              { label: 'PENDING', value: 'pending' },
              { label: 'RECEIVED (SETTLED)', value: 'received' },
              { label: 'CANCELLED', value: 'cancelled' }
            ]
          },
          { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Services' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
          { name: 'metadata', label: 'Metadata (JSON)', type: 'textarea' }
        ]}
      />

      <CreateModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Add Task"
        mode="create"
        onSubmit={handleTaskSubmit}
        initialValues={{
          priority: 'medium',
          status: 'today',
          business_id: contact?.business_id || 'none'
        }}
        fields={[
          { name: 'title', label: 'Task Title', type: 'text' },
          { name: 'description', label: 'Description', type: 'textarea' },
          {
            name: 'business_id',
            label: 'Business',
            type: 'select',
            options: [
              { label: 'NO BUSINESS', value: 'none' },
              ...businesses.map(b => ({ label: b.name.toUpperCase(), value: b.id }))
            ]
          },
          {
            name: 'project_id',
            label: 'Project',
            type: 'select',
            options: [
              { label: 'NO PROJECT', value: 'none' },
              ...allProjects.map(p => ({ label: p.name.toUpperCase(), value: p.id }))
            ]
          },
          {
            name: 'priority',
            label: 'Priority',
            type: 'select',
            options: ['low', 'medium', 'high', 'urgent'].map(p => ({ label: p.toUpperCase(), value: p }))
          },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: ['backlog', 'today', 'in_progress', 'waiting', 'done', 'cancelled'].map(s => ({ label: s.toUpperCase(), value: s }))
          },
          { name: 'due_date', label: 'Due Date', type: 'date' },
          { name: 'notes', label: 'Internal Notes', type: 'textarea' }
        ]}
      />

      <CreateModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        title="Quick Notes Edit"
        mode="edit"
        onSubmit={handleNotesQuickUpdate}
        initialValues={{ notes: contact?.notes }}
        fields={[
          { name: 'notes', label: 'Contact Notes', type: 'textarea' }
        ]}
      />
    </div>
  );
}

interface ProjectLinkCreatorFormProps {
  allProjects: Project[];
  existingLinkedIds: string[];
  onSave: (projectId: string, relationshipType: string, notes: string) => Promise<void>;
}

function ProjectLinkCreatorForm({ allProjects, existingLinkedIds, onSave }: ProjectLinkCreatorFormProps) {
  const [projectId, setProjectId] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const availableProjects = allProjects.filter(p => !existingLinkedIds.includes(p.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setLoading(true);
    await onSave(projectId, relationshipType, notes);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 max-w-xl">
      <h4 className="text-xs font-black uppercase text-purple-400 tracking-[0.2em]">Link with a Project</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">Select Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-purple-500 outline-none"
          >
            <option value="">Choose Project...</option>
            {availableProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">Relationship / Role</label>
          <input
            type="text"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            placeholder="e.g. Lead Contractor, Client Rep"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-purple-500 outline-none"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">Relationship Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter notes about this link..."
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-purple-500 outline-none min-h-[70px]"
        />
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!projectId || loading}
          className="px-6 py-2.5 rounded-xl bg-white text-slate-950 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? 'Linking...' : 'Establish Connection'}
        </button>
      </div>
    </form>
  );
}

