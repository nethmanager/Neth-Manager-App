import React, { useState } from 'react';
import { 
  Plus, 
  Wallet, 
  BookOpen, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  AlertCircle,
  PiggyBank,
  ChevronRight,
  TrendingUp,
  Receipt,
  Building2,
  Briefcase,
  Layers,
  Calendar as CalendarIcon,
  ExternalLink,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import { useUI } from '../contexts/UIContext';
import { 
  Expense, 
  FinancialAccount, 
  PhonebookContact, 
  Business, 
  Project, 
  ProjectItem 
} from '../types';
import CreateModal from '../components/CreateModal';
import ExpenseReceiptManager from '../components/ExpenseReceiptManager';

type Tab = 'cashflow' | 'accounts';

export default function Finance() {
  const { user } = useUser();
  const { confirm, showToast } = useUI();
  const [activeTab, setActiveTab] = useState<Tab>('cashflow');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals for each entity
  const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit' | 'view'; expense: Expense | null }>({
    isOpen: false,
    mode: 'create',
    expense: null
  });
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit' | 'view'; account: FinancialAccount | null }>({
    isOpen: false,
    mode: 'create',
    account: null
  });

  const [accountTypeChooserOpen, setAccountTypeChooserOpen] = useState(false);
  const [accountCreateFlow, setAccountCreateFlow] = useState<'bank' | 'sub_account' | 'card' | null>(null);

  // Queries
  const { data: expenses, loading: expensesLoading, refetch: refetchExpenses } = useSupabaseQuery<Expense[]>(
    () => supabase.from('expenses').select('*, business:businesses(name), project:projects(name), project_item:project_items(name), account:financial_accounts(name), contact:phonebook_contacts(name)').order('expense_date', { ascending: false }),
    []
  );
const { data: accounts, loading: accountsLoading, refetch: refetchAccounts } = useSupabaseQuery<FinancialAccount[]>(
  () => supabase
    .from('financial_accounts')
    .select('*')
    .or('status.is.null,status.neq.archived')
    .order('name', { ascending: true }),
  []
);

const { data: accountBusinessLinks, refetch: refetchAccountBusinessLinks } = useSupabaseQuery<any[]>(
  () => supabase
    .from('financial_account_businesses')
    .select('financial_account_id, business:businesses(id, name)')
    .order('created_at', { ascending: true }),
  []
);

const getAccountBusinesses = (accountId: string) => {
  return accountBusinessLinks?.filter(link => link.financial_account_id === accountId) || [];
};
const getAccountCreateFlow = (account: FinancialAccount): 'bank' | 'sub_account' | 'card' => {
  if (account.parent_id) return 'sub_account';
  if (account.account_type === 'credit_card' || account.account_type === 'debit_card') return 'card';
  return 'bank';
};

const openAccountEdit = async (account: FinancialAccount) => {
  const { data: links } = await supabase
    .from('financial_account_businesses')
    .select('business_id')
    .eq('financial_account_id', account.id);

  const businessIds = links?.map(l => l.business_id) || [];

  setAccountCreateFlow(getAccountCreateFlow(account));
  setAccountModal({
    isOpen: true,
    mode: 'edit',
    account: { ...account, multi_businesses: businessIds } as any
  });
};
  const { data: contacts } = useSupabaseQuery<PhonebookContact[]>(
    () => supabase.from('phonebook_contacts').select('id, name, contact_type, company_name').order('name', { ascending: true }),
    []
  );

  // Common data
  const { data: businesses } = useSupabaseQuery<Business[]>(() => supabase.from('businesses').select('id, name'), []);
  const { data: projects } = useSupabaseQuery<Project[]>(() => supabase.from('projects').select('id, name, business_id'), []);
  
  // Selection state for multi-project linking in Expense Modal
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null); // For item filtering
  const { data: projectItems } = useSupabaseQuery<ProjectItem[]>(
    () => selectedProjectId ? supabase.from('project_items').select('id, name').eq('project_id', selectedProjectId) : Promise.resolve({ data: [] }),
    [selectedProjectId]
  );

  const handleExpenseSubmit = async (data: any) => {
    if (!user) return;
    try {
      // Amount check
      const amount = parseFloat(data.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid positive amount.');
      }

      // JSON parsing safety
      const parseJson = (str: string) => {
        if (!str || !str.trim()) return null;
        try {
          return JSON.parse(str);
        } catch (e) {
          throw new Error('Invalid JSON format for metadata or recurring config.');
        }
      };

      const sanitizeId = (id: any) => id && id.trim() !== '' ? id : null;

      const metadata = parseJson(data.metadata);
      const recurring_config = parseJson(data.recurring_config);

      const expenseData = {
        title: data.title?.trim(),
        description: data.description?.trim() || null,
        amount: amount,
        tax_amount: parseFloat(data.tax_amount) || 0,
        currency: data.currency || 'USD',
        category: data.category || 'Other',
        expense_date: data.expense_date || new Date().toISOString().split('T')[0],
status: data.status || 'pending',
direction: data.direction || 'out',
subcategory: data.subcategory?.trim() || null,
payment_type: data.payment_type || 'bank_transfer',
due_date: data.due_date || null,
reference_number: data.reference_number?.trim() || null,
receipt_url: data.receipt_url?.trim() || null,
        business_id: sanitizeId(data.business_id),
        project_id: selectedProjectIds[0] || null,
        project_item_id: sanitizeId(data.project_item_id),
        financial_account_id: sanitizeId(data.financial_account_id),
        counterparty_contact_id: sanitizeId(data.counterparty_contact_id),
        recurring_config,
        metadata,
        is_recurring: data.is_recurring === 'true' || data.is_recurring === true,
        notes: data.notes?.trim() || null,
settled_at: data.settled_at
  ? new Date(data.settled_at).toISOString()
  : ((data.status === 'paid' || data.status === 'received') ? new Date().toISOString() : null),
updated_at: new Date().toISOString()
      };

      if (!expenseData.title) throw new Error('Expense title is required.');

      let expenseId: string;

      if (expenseModal.mode === 'create') {
        const { data: newExp, error } = await supabase.from('expenses').insert({
          ...expenseData,
          user_id: user.id,
          created_at: new Date().toISOString()
        }).select().single();
        
        if (error) throw error;
        expenseId = newExp.id;
        
        // Log activity (do not block)
        supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'create',
          entity_type: 'expense',
          entity_id: expenseId,
          details: { title: expenseData.title, amount: expenseData.amount }
        }).then(({ error: logError }) => {
          if (logError) console.warn('Activity log failed:', logError);
        });
      } else {
        const { data: updatedExp, error } = await supabase.from('expenses').update(expenseData).eq('id', expenseModal.expense!.id).select().single();
        if (error) throw error;
        expenseId = updatedExp.id;
        
        // Log activity (do not block)
        supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'update',
          entity_type: 'expense',
          entity_id: expenseId,
          details: { title: expenseData.title, amount: expenseData.amount }
        }).then(({ error: logError }) => {
          if (logError) console.warn('Activity log failed:', logError);
        });
      }

      // Handle multi-projects
      await supabase.from('expense_project_links').delete().eq('expense_id', expenseId);
      if (selectedProjectIds.length > 0) {
        await supabase.from('expense_project_links').insert(
          selectedProjectIds.map(pid => ({
            user_id: user.id,
            expense_id: expenseId,
            project_id: pid
          }))
        ).then(({ error: logError }) => {
          if (logError) console.warn('Project linking failed:', logError);
        });
      }

      refetchExpenses();
      setExpenseModal(prev => ({ ...prev, isOpen: false }));
      showToast.success(`Expense ${expenseModal.mode === 'create' ? 'created' : 'updated'} successfully`);
    } catch (err: any) {
      showToast.error('Error: ' + err.message);
    }
  };

  const handleAccountSubmit = async (data: any) => {
    if (!user) return;
    try {
      // Parse JSON
      let metadata = null;
      if (data.metadata && data.metadata.trim()) {
        try {
          metadata = JSON.parse(data.metadata);
        } catch (e) {
          throw new Error('Invalid Metadata JSON format');
        }
      }

      const sanitizeUuid = (id: any) => id && id.trim() !== '' ? id : null;
      const openingBalance = parseFloat(data.opening_balance || 0);
      const currentBalance = parseFloat(data.current_balance !== '' && data.current_balance !== undefined ? data.current_balance : openingBalance);
      
      // Normalization per flow
      let accountType = data.account_type;
      let parentId = sanitizeUuid(data.parent_id);

      if (accountCreateFlow === 'bank') {
        parentId = null;
        accountType = data.account_type || 'bank';
      } else if (accountCreateFlow === 'sub_account') {
        accountType = data.account_type || 'savings';
        if (!parentId) throw new Error('Parent account is required for sub-accounts.');
      } else if (accountCreateFlow === 'card') {
        accountType = (data.account_type === 'debit_card') ? 'debit_card' : 'credit_card';
      }

      // Handle multi-businesses
      const multiBusinesses = Array.isArray(data.multi_businesses) ? data.multi_businesses : [];
      
      const accountData = {
        name: data.name?.trim(),
        account_type: accountType,
        parent_id: parentId,
        institution_name: data.institution_name?.trim() || null,
        account_number_last4: data.account_number_last4?.trim()?.slice(-4) || null,
        currency: data.currency || 'USD',
        business_id: multiBusinesses.length > 0 ? multiBusinesses[0] : null,
        metadata,
        notes: data.notes?.trim() || null,
        opening_balance: openingBalance,
        current_balance: currentBalance,
        status: data.status || 'active',
        updated_at: new Date().toISOString()
      };

      if (!accountData.name) throw new Error('Account name is required.');
      
      let accountId: string;
      if (accountModal.mode === 'create') {
        const { data: newAcc, error } = await supabase.from('financial_accounts').insert({
          ...accountData,
          user_id: user.id,
          created_at: new Date().toISOString()
        }).select().single();
        if (error) throw error;
        accountId = newAcc.id;

        // Log activity (do not block)
        supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'create',
          entity_type: 'financial_account',
          entity_id: accountId,
          details: { name: accountData.name }
        }).then(({ error: logError }) => {
          if (logError) console.warn('Activity log failed:', logError);
        });
      } else {
        accountId = accountModal.account!.id;
        const { error } = await supabase.from('financial_accounts').update(accountData).eq('id', accountId);
        if (error) throw error;

        // Log activity (do not block)
        supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'update',
          entity_type: 'financial_account',
          entity_id: accountId,
          details: { name: accountData.name }
        }).then(({ error: logError }) => {
          if (logError) console.warn('Activity log failed:', logError);
        });
      }

     const { error: deleteLinksError } = await supabase
  .from('financial_account_businesses')
  .delete()
  .eq('financial_account_id', accountId);

if (deleteLinksError) throw deleteLinksError;

if (multiBusinesses.length > 0) {
  const { error: linkError } = await supabase
    .from('financial_account_businesses')
    .insert(
      multiBusinesses.map((bid: string) => ({
        user_id: user.id,
        financial_account_id: accountId,
        business_id: bid
      }))
    );

  if (linkError) throw linkError;
}

     refetchAccounts();
refetchAccountBusinessLinks();
setAccountModal(prev => ({ ...prev, isOpen: false }));
      showToast.success(`Account ${accountModal.mode === 'create' ? 'created' : 'updated'} successfully`);
    } catch (err: any) {
      showToast.error('Error: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    const isConfirmed = await confirm({
      title: 'Cancel Transaction',
      message: 'Cancel this transaction? It will remain in history but will no longer be considered active.',
      confirmLabel: 'Cancel Transaction',
      isDestructive: true
    });
    
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('expenses').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'cancel',
        entity_type: 'expense',
        entity_id: id,
        details: { title }
      });
      refetchExpenses();
      refetchAccounts();
      showToast.success('Transaction cancelled');
    } catch (err: any) {
      showToast.error('Delete failed: ' + err.message);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Archive Account',
      message: 'Archive this account? This will hide it from view.',
      confirmLabel: 'Archive',
      isDestructive: true
    });

    if (!isConfirmed) return;
    
    try {
      const { error } = await supabase.from('financial_accounts').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'archive',
        entity_type: 'financial_account',
        entity_id: id,
        details: { name }
      });
      refetchAccounts();
      showToast.success('Account archived');
    } catch (err: any) {
      showToast.error('Archive failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em]">Finance & Cashflow</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Finance</h2>
          <p className="text-white/40 text-sm mt-1">Manage expenses, income, and financial accounts.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (activeTab === 'cashflow') {
                setSelectedProjectIds([]);
                setSelectedProjectId(null);
                setExpenseModal({ isOpen: true, mode: 'create', expense: null });
              } else {
                setAccountTypeChooserOpen(true);
              }
            }}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 group"
          >
            <Plus size={18} />
            Add {activeTab === 'cashflow' ? 'Expense' : 'Account'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('cashflow')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
            activeTab === 'cashflow' ? "bg-white text-slate-950 shadow-lg" : "text-white/40 hover:text-white/60"
          )}
        >
          <Receipt size={14} /> Cashflow
        </button>
        <button 
          onClick={() => setActiveTab('accounts')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
            activeTab === 'accounts' ? "bg-white text-slate-950 shadow-lg" : "text-white/40 hover:text-white/60"
          )}
        >
          <CreditCard size={14} /> Accounts
        </button>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'cashflow' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/10 transition-colors"
                />
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Date</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Entity & Item</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Project</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-[0.3em] text-right">Amount</th>
                    <th className="px-8 py-5 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
{expenses?.filter(e => (e.title || '').toLowerCase().includes(searchQuery.toLowerCase())).map((expense) => (
                      <tr key={expense.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white uppercase tracking-tight">{new Date(expense.expense_date).toLocaleDateString()}</span>
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">{expense.category || 'Uncategorized'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-xl border",
                            expense.direction === 'in' 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          )}>
                            {expense.direction === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white uppercase">{expense.title}</p>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-0.5">
                              {expense.business?.name} {expense.contact?.name && `- ${expense.contact.name}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {expense.project ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{expense.project.name}</span>
                            {expense.project_item && <span className="text-[9px] text-white/30 truncate max-w-[150px] uppercase font-bold">{expense.project_item.name}</span>}
                          </div>
                        ) : (
                          <span className="text-[9px] font-black text-white/10 uppercase tracking-widest italic">No links</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          (expense.status === 'paid' || expense.status === 'received') ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          (expense.status === 'pending' || expense.status === 'planned') ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                          "bg-red-500/10 border-red-500/20 text-red-400"
                        )}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className={cn(
                          "text-sm font-black",
                          expense.direction === 'in' ? "text-emerald-400" : "text-white"
                        )}>
                          {expense.direction === 'in' ? '+' : '-'}{expense.currency} {Number(expense.amount || 0).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={async () => {
                              // Fetch linked projects
                              const { data: links } = await supabase.from('expense_project_links').select('project_id').eq('expense_id', expense.id);
                              setSelectedProjectIds(links?.map(l => l.project_id) || []);
                              setSelectedProjectId(expense.project_id);
                              setExpenseModal({ isOpen: true, mode: 'edit', expense });
                            }}
                            className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteExpense(expense.id, expense.title)}
                            className="p-2 rounded-xl text-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expenses?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center opacity-20 capitalize">
                          <Receipt size={48} className="mb-4" />
                          <p className="text-xs font-black uppercase tracking-[0.4em]">No financial data yet</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards View */}
            <div className="block md:hidden space-y-4">
              {expenses?.filter(e => (e.title || '').toLowerCase().includes(searchQuery.toLowerCase())).map((expense) => (
                <div key={expense.id} className="bg-white/5 border border-white/5 rounded-3xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl border shrink-0",
                        expense.direction === 'in' 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : "bg-red-500/10 border-red-500/20 text-red-400"
                      )}>
                        {expense.direction === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-tight leading-tight">{expense.title}</h4>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider font-extrabold mt-1">
                          {new Date(expense.expense_date).toLocaleDateString()} • {expense.category || 'Uncategorized'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-black",
                        expense.direction === 'in' ? "text-emerald-400" : "text-white"
                      )}>
                        {expense.direction === 'in' ? '+' : '-'}{expense.currency} {Number(expense.amount || 0).toFixed(2)}
                      </p>
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border mt-1",
                        (expense.status === 'paid' || expense.status === 'received') ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        (expense.status === 'pending' || expense.status === 'planned') ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                        "bg-red-500/10 border-red-500/20 text-red-400"
                      )}>
                        {expense.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 text-[11px] uppercase font-bold text-white/40">
                    <div>
                      <span className="text-[9px] text-white/20 block font-normal lowercase tracking-widest mb-0.5">Entity / contact</span>
                      <span className="text-white/60">
                        {expense.business?.name || 'Independent'}
                        {expense.contact?.name && ` - ${expense.contact.name}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/20 block font-normal lowercase tracking-widest mb-0.5">Project / Item</span>
                      <span className="text-white/60 truncate block max-w-[150px]">
                        {expense.project ? (
                          <>
                            <span className="text-blue-400">{expense.project.name}</span>
                            {expense.project_item && <span className="text-white/30 block text-[9px] font-bold">{expense.project_item.name}</span>}
                          </>
                        ) : (
                          'No project linked'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                    <button 
                      onClick={async () => {
                        const { data: links } = await supabase.from('expense_project_links').select('project_id').eq('expense_id', expense.id);
                        setSelectedProjectIds(links?.map(l => l.project_id) || []);
                        setSelectedProjectId(expense.project_id);
                        setExpenseModal({ isOpen: true, mode: 'edit', expense });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all text-[10px] uppercase font-black tracking-wider"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteExpense(expense.id, expense.title)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all text-[10px] uppercase font-black tracking-wider"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
              {expenses?.length === 0 && (
                <div className="bg-white/5 border border-white/5 rounded-3xl p-10 text-center">
                  <div className="flex flex-col items-center opacity-20 capitalize">
                    <Receipt size={40} className="mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.4em]">No financial data yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-12">
            {accounts?.filter(a => !a.parent_id).map(mainAccount => {
              const subAccounts = accounts?.filter(a => a.parent_id === mainAccount.id);
              return (
                <div key={mainAccount.id} className="space-y-6">
                  {/* Main Account Row */}
                  <div className="group bg-white/5 border border-white/5 rounded-[2.5rem] p-8 hover:border-white/20 transition-all hover:bg-white/[0.07] shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "p-4 rounded-3xl shrink-0 border",
                          ['credit_card', 'debit_card'].includes(mainAccount.account_type) 
                            ? "bg-purple-500/10 border-purple-500/10 text-purple-400"
                            : ['wallet', 'payment_processor', 'crypto'].includes(mainAccount.account_type)
                              ? "bg-blue-500/10 border-blue-500/10 text-blue-400"
                              : "bg-emerald-500/10 border-emerald-500/10 text-emerald-400"
                        )}>
                          {['credit_card', 'debit_card'].includes(mainAccount.account_type) ? (
                            <CreditCard size={28} />
                          ) : ['wallet', 'payment_processor', 'crypto'].includes(mainAccount.account_type) ? (
                            <Wallet size={28} />
                          ) : (
                            <PiggyBank size={28} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-white uppercase tracking-tight">{mainAccount.name}</h3>
                            <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[8px] font-black text-white/40 uppercase tracking-widest">{mainAccount.account_type}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{mainAccount.institution_name}</p>
                            {mainAccount.account_number_last4 && <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] flex items-center gap-1">- <BookOpen size={10} /> {mainAccount.account_number_last4}</span>}
                          {getAccountBusinesses(mainAccount.id).length > 0 && (
  <div className="flex gap-1 ml-2">
    {getAccountBusinesses(mainAccount.id).map((b: any, bi: number) => (
      <span key={bi} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-black text-emerald-400 uppercase tracking-widest">
        {b.business?.name}
      </span>
    ))}
  </div>
)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Aggregate Balance</span>
                          <span className="text-2xl font-black text-white">
{mainAccount.currency} {(Number(mainAccount.current_balance || 0) + (subAccounts?.reduce((sum, sa) => sum + (sa.currency === mainAccount.currency ? Number(sa.current_balance || 0) : 0), 0) || 0)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
  setSelectedProjectId(null);
  setAccountCreateFlow('sub_account');
  setAccountModal({ isOpen: true, mode: 'create', account: { parent_id: mainAccount.id, institution_name: mainAccount.institution_name, business_id: mainAccount.business_id } as any });
}}  
                            className="p-3 rounded-2xl bg-white/5 text-emerald-400 hover:bg-white/10 transition-all"
                            title="Add Sub-account"
                          >
                            <Plus size={18} />
                          </button>
                          <button 
                           onClick={() => openAccountEdit(mainAccount)}
                            className="p-3 rounded-2xl bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteAccount(mainAccount.id, mainAccount.name)} className="p-3 rounded-2xl bg-white/5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub Accounts Grid */}
                  {subAccounts && subAccounts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-12">
                      {subAccounts.map(sub => (
                        <div key={sub.id} className="group/sub bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-white/20 transition-all hover:bg-white/[0.08] relative">
                          <div className="flex justify-between items-start mb-6">
                            <div className={cn(
                              "p-2.5 rounded-2xl border",
                              ['credit_card', 'debit_card'].includes(sub.account_type) 
                                ? "bg-purple-500/10 border-purple-500/20 text-purple-400" 
                                : sub.parent_id
                                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                  : "bg-white/5 border-white/5 text-white/40"
                            )}>
                              {['credit_card', 'debit_card'].includes(sub.account_type) ? (
                                <CreditCard size={18} />
                              ) : sub.parent_id ? (
                                <Receipt size={18} />
                              ) : (
                                <Wallet size={18} />
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                              <button 
                             onClick={() => openAccountEdit(sub)} 
                                className="p-2 rounded-xl text-white/20 hover:text-white transition-all"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => handleDeleteAccount(sub.id, sub.name)} className="p-2 rounded-xl text-red-500/20 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
                            </div>
                          </div>

                          <div className="mb-6">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-white uppercase tracking-tight line-clamp-1">{sub.name}</h4>
                              <span className="text-[7px] font-black text-white/20 uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5">{sub.currency}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">{sub.account_type}</p>
                           {getAccountBusinesses(sub.id).length > 0 && (
  <div className="flex gap-1">
    {getAccountBusinesses(sub.id).map((b: any, bi: number) => (
      <span key={bi} className="px-1 py-0.5 rounded bg-white/5 border border-white/5 text-[6px] font-black text-white/40 uppercase tracking-widest">
        {b.business?.name}
      </span>
    ))}
  </div>
)}
                          </div>
                          </div>

                          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-white">{sub.currency} {Number(sub.current_balance || 0).toFixed(2)}</span>
                            </div>
                            <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                              {sub.account_number_last4 ? `•••• ${sub.account_number_last4}` : 'No Details'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!accounts?.length && (
              <button 
                onClick={() => setAccountTypeChooserOpen(true)}
                className="col-span-full border-2 border-dashed border-white/5 rounded-[2.5rem] py-20 flex flex-col items-center justify-center group hover:border-white/10 transition-all opacity-40"
              >
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-4 group-hover:text-emerald-400"><Plus size={32} /></div>
                <p className="text-xs font-black uppercase tracking-[0.4em]">Register first account</p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Account Type Chooser Modal */}
      <CreateModal
        isOpen={accountTypeChooserOpen}
        onClose={() => setAccountTypeChooserOpen(false)}
        title="What do you want to add?"
        onSubmit={async () => {}} // Not used as buttons handle it
        mode="view"
        hideFooter
        fields={[]}
      >
        <div className="grid grid-cols-1 gap-4 p-8 pt-0">
          <button
            onClick={() => {
              setAccountCreateFlow('bank');
              setAccountTypeChooserOpen(false);
              setAccountModal({ isOpen: true, mode: 'create', account: null });
            }}
            className="group flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left"
          >
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Building2 size={24} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-tight mb-1">Bank / Institution</h4>
              <p className="text-[10px] text-white/40 uppercase font-medium leading-relaxed">Main bank, wallet, processor, cash location, or crypto account.</p>
            </div>
            <ChevronRight size={20} className="text-white/10 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => {
              setAccountCreateFlow('sub_account');
              setAccountTypeChooserOpen(false);
              setAccountModal({ isOpen: true, mode: 'create', account: null });
            }}
            className="group flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left"
          >
            <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <Receipt size={24} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-tight mb-1">Sub-account / Balance</h4>
              <p className="text-[10px] text-white/40 uppercase font-medium leading-relaxed">USD balance, MXN balance, checking, savings, reserve, or balance pocket.</p>
            </div>
            <ChevronRight size={20} className="text-white/10 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => {
              setAccountCreateFlow('card');
              setAccountTypeChooserOpen(false);
              setAccountModal({ isOpen: true, mode: 'create', account: null });
            }}
            className="group flex items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left"
          >
            <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
              <CreditCard size={24} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-tight mb-1">Card</h4>
              <p className="text-[10px] text-white/40 uppercase font-medium leading-relaxed">Credit card or debit card connected to a bank or provider.</p>
            </div>
            <ChevronRight size={20} className="text-white/10 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </CreateModal>

      {/* Expense Modal */}
      <CreateModal
        isOpen={expenseModal.isOpen}
        onClose={() => setExpenseModal(prev => ({ ...prev, isOpen: false }))}
        title={expenseModal.mode === 'create' ? "Add Expense" : "Edit Expense"}
        onSubmit={handleExpenseSubmit}
        initialValues={expenseModal.expense}
        mode={expenseModal.mode}
        fields={[
          {
            name: 'direction',
            label: 'Direction',
            type: 'select' as any,
            options: [
              { label: 'Out (Expense/Cost)', value: 'out' },
              { label: 'In (Income/Revenue)', value: 'in' }
            ],
            defaultValue: 'out'
          },
          { name: 'title', label: 'Title', type: 'text' as any, placeholder: 'e.g. Monthly Rent, Client Payment' },
          { name: 'amount', label: 'Amount', type: 'text' as any, placeholder: '0.00' },
          { name: 'tax_amount', label: 'Tax Amount', type: 'text' as any, placeholder: '0.00' },
          { 
            name: 'currency', 
            label: 'Currency', 
            type: 'select' as any, 
            options: [
              { label: 'USD - Dollar', value: 'USD' },
              { label: 'MXN - Peso', value: 'MXN' },
              { label: 'EUR - Euro', value: 'EUR' }
            ], 
            defaultValue: 'USD' 
          },
          {
            name: 'business_id',
            label: 'Business',
            type: 'select' as any,
            options: [
  { label: 'None', value: '' },
  ...(businesses?.map(b => ({ label: b.name, value: b.id })) || [])
]
          },
          
          {
  name: 'financial_account_id',
  label: 'Financial Account',
  type: 'select' as any,
  options: [
    { label: 'None', value: '' },
    ...(accounts?.map(a => {
      const parent = a.parent_id ? accounts.find(p => p.id === a.parent_id) : null;
      return { 
        label: parent ? `${parent.name} > ${a.name} (${a.currency})` : `${a.name} (${a.currency})`, 
        value: a.id 
      };
    }) || [])
  ]
},
         {
  name: 'counterparty_contact_id',
  label: 'Counterparty (Contact)',
  type: 'select' as any,
  options: [
    { label: 'None', value: '' },
    ...(contacts?.map(c => ({ label: c.name, value: c.id })) || [])
  ]
},
          { name: 'category', label: 'Category', type: 'text' as any, placeholder: 'e.g. Rent, Marketing, Salary' },
          { name: 'subcategory', label: 'Subcategory', type: 'text' as any },
          { 
  name: 'payment_type', 
  label: 'Payment Method', 
  type: 'select' as any,
  defaultValue: 'bank_transfer',
  options: [
              { label: 'Bank Transfer', value: 'bank_transfer' },
              { label: 'Debit Card', value: 'debit_card' },
              { label: 'Credit Card', value: 'credit_card' },
              { label: 'Cash', value: 'cash' },
              { label: 'PayPal', value: 'paypal' },
              { label: 'Stripe', value: 'stripe' },
              { label: 'Wise', value: 'wise' },
              { label: 'Zelle', value: 'zelle' },
              { label: 'Check', value: 'check' },
              { label: 'Crypto', value: 'crypto' },
              { label: 'Other', value: 'other' }
            ] 
          },
          { name: 'expense_date', label: 'Date', type: 'date' as any },
          { name: 'due_date', label: 'Due Date', type: 'date' as any },
          { name: 'settled_at', label: 'Settled Date', type: 'date' as any },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select' as any, 
            options: [
              { label: 'Planned', value: 'planned' },
              { label: 'Pending', value: 'pending' },
              { label: 'Paid (Settled)', value: 'paid' },
              { label: 'Received (Settled)', value: 'received' },
              { label: 'Cancelled', value: 'cancelled' }
            ],
            defaultValue: 'pending'
          },
          {
            name: 'project_item_id',
            label: 'Related Item (Product/Feature/Asset)',
            type: 'select' as any,
            options: [
              { label: 'None', value: '' },
              ...(projectItems?.map(item => ({ label: item.name, value: item.id })) || [])
            ]
          },
          { name: 'reference_number', label: 'Reference / Invoice #', type: 'text' as any },
          { name: 'receipt_url', label: 'Receipt/PDF Link', type: 'text' as any },
          { name: 'is_recurring', label: 'Is Recurring', type: 'select' as any, options: [{label: 'No', value: 'false'}, {label: 'Yes', value: 'true'}], defaultValue: 'false' },
          { name: 'recurring_config', label: 'Recurring Config (JSON)', type: 'textarea' as any, placeholder: '{"frequency": "monthly"}' },
          { name: 'notes', label: 'Internal Notes', type: 'textarea' as any },
          { name: 'metadata', label: 'Advanced Metadata (JSON)', type: 'textarea' as any, placeholder: '{"key": "value"}' }
        ]}
      >
        <div className="space-y-8 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Connect to Projects</label>
              <div className="text-[9px] font-bold text-white/20 italic">Multi-link supported</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {projects?.map(p => {
                const isSelected = selectedProjectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                        if (selectedProjectId === p.id) setSelectedProjectId(null);
                      } else {
                        setSelectedProjectIds(prev => [...prev, p.id]);
                        if (!selectedProjectId) setSelectedProjectId(p.id);
                      }
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      isSelected ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 bg-white/[0.03] p-6 rounded-3xl border border-white/5">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-white/20" />
              <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Filter Items by Project</label>
            </div>
            <div className="space-y-2">
              <select 
                value={selectedProjectId || ''} 
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="">All or No Project Selected</option>
                {projects?.filter(p => selectedProjectIds.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {expenseModal.mode !== 'create' && expenseModal.expense?.id && user?.id && (
            <div className="pt-6 border-t border-white/5">
              <ExpenseReceiptManager 
                expenseId={expenseModal.expense.id} 
                userId={user.id}
              />
            </div>
          )}
        </div>
      </CreateModal>

      {/* Account Modal */}
      <CreateModal
        isOpen={accountModal.isOpen}
        onClose={() => setAccountModal(prev => ({ ...prev, isOpen: false }))}
        title={accountModal.mode === 'create' ? "Add Account" : "Edit Account"}
        onSubmit={handleAccountSubmit}
        initialValues={accountModal.account}
        mode={accountModal.mode}
        fields={[
          ...(accountCreateFlow === 'bank' ? [
            { name: 'name', label: 'Account Name', type: 'text' as any, placeholder: 'e.g. Wise Business' },
            { 
              name: 'account_type', 
              label: 'Account Category', 
              type: 'select' as any, 
              options: [
                { label: 'Bank Account', value: 'bank' },
                { label: 'Wallet', value: 'wallet' },
                { label: 'Payment Processor (Stripe, PayPal)', value: 'payment_processor' },
                { label: 'Cash / Safe', value: 'cash' },
                { label: 'Crypto Account', value: 'crypto' },
                { label: 'Other', value: 'other' }
              ],
              defaultValue: 'bank'
            },
            { name: 'institution_name', label: 'Institution / Provider Name', type: 'text' as any, placeholder: 'e.g. Chase, Wise, Stripe' },
          ] : []),

          ...(accountCreateFlow === 'sub_account' ? [
            {
              name: 'parent_id',
              label: 'Parent Account',
              type: 'select' as any,
              options: [
                { label: 'Select a Parent Account...', value: '' },
                ...(accounts
  ?.filter(a => !a.parent_id && !['credit_card', 'debit_card'].includes(a.account_type))
  .map(a => ({ label: a.name, value: a.id })) || [])
              ]
            },
            { 
              name: 'account_type', 
              label: 'Account Category', 
              type: 'select' as any, 
              options: [
                { label: 'Checking Account', value: 'checking' },
                { label: 'Savings Account', value: 'savings' },
                { label: 'Wallet', value: 'wallet' },
                { label: 'Payment Processor (Stripe, PayPal)', value: 'payment_processor' },
                { label: 'Cash / Safe', value: 'cash' },
                { label: 'Crypto Account', value: 'crypto' },
                { label: 'Other', value: 'other' }
              ],
              defaultValue: 'savings'
            },
            { name: 'name', label: 'Sub-account Name', type: 'text' as any, placeholder: 'e.g. USD Balance, Savings' },
          ] : []),

          ...(accountCreateFlow === 'card' ? [
            { 
              name: 'account_type', 
              label: 'Card Type', 
              type: 'select' as any, 
              options: [
                { label: 'Credit Card', value: 'credit_card' },
                { label: 'Debit Card', value: 'debit_card' }
              ],
              defaultValue: 'credit_card'
            },
            {
              name: 'parent_id',
              label: 'Connected To (Optional)',
              type: 'select' as any,
              options: [
                { label: 'None (Stand-alone Card)', value: '' },
                ...(accounts
  ?.filter(a => !a.parent_id && !['credit_card', 'debit_card'].includes(a.account_type))
  .map(a => ({ label: a.name, value: a.id })) || [])
              ]
            },
            { name: 'name', label: 'Card Name (Display)', type: 'text' as any, placeholder: 'e.g. Visa Business, Amex' },
            { name: 'institution_name', label: 'Issuer / Bank Name', type: 'text' as any, placeholder: 'e.g. Amex, Chase' },
            { name: 'account_number_last4', label: 'Last 4 Digits', type: 'text' as any, placeholder: '1234' },
          ] : []),

          { 
            name: 'currency', 
            label: 'Currency', 
            type: 'select' as any, 
            options: [
              { label: 'USD', value: 'USD' },
              { label: 'MXN', value: 'MXN' },
              { label: 'EUR', value: 'EUR' },
              { label: 'GBP', value: 'GBP' }
            ],
            defaultValue: 'USD'
          },
          { name: 'opening_balance', label: 'Opening Balance', type: 'text' as any, placeholder: '0.00' },
          { name: 'current_balance', label: 'Current Balance (Leave blank if same as opening)', type: 'text' as any, placeholder: '0.00' },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select' as any, 
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Archived', value: 'archived' }
            ],
            defaultValue: 'active'
          },
          
          {
            name: 'multi_businesses',
            label: 'Associated Business(es)',
            type: 'checkbox-group' as any,
            options: businesses?.map(b => ({ label: b.name, value: b.id })) || []
          },
          { name: 'notes', label: 'Notes', type: 'textarea' as any },
          { name: 'metadata', label: 'Advanced Metadata (JSON)', type: 'textarea' as any }
        ]}
      />
    </div>
  );
}
