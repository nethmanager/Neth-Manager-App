import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft,
  Calendar,
  Tag,
  ChevronRight,
  Plus,
  Trash2,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Project, Expense } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';

interface ProjectExpensesProps {
  project: Project;
  onUpdate?: () => void;
  createSignal?: string | number;
  onActionConsumed?: () => void;
}

export default function ProjectExpenses({ project, onUpdate, createSignal, onActionConsumed }: ProjectExpensesProps) {
  const { confirm, showToast } = useUI();
  const [isAdding, setIsAdding] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isQuickAddingContact, setIsQuickAddingContact] = useState(false);
  const [quickContactData, setQuickContactData] = useState({
    name: '',
    type: 'other',
    company: '',
    email: '',
    phone: ''
  });
  
  const [formData, setFormData] = useState({
    direction: 'out',
    title: '',
    amount: '',
    currency: 'USD',
    category: 'Operation',
    selected_account_id: 'cash',
    counterparty_contact_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: ''
  });

  const fetchExpenses = async () => {
    setLoadingList(true);
    try {
      const [directRes, linkedRes, accountsRes, contactsRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, account:financial_accounts(name), contact:phonebook_contacts(name)')
          .eq('project_id', project.id),
        supabase
          .from('expense_project_links')
          .select('expense:expenses(*, account:financial_accounts(name), contact:phonebook_contacts(name))')
          .eq('project_id', project.id),
        supabase
          .from('financial_accounts')
          .select('id, name, account_type, currency, parent_id, status')
          .or('status.eq.active,status.is.null')
          .order('name'),
        supabase
          .from('phonebook_contacts')
          .select('id, name, contact_type, company_name, email')
          .order('name')
      ]);

      if (directRes.error) throw directRes.error;
      if (linkedRes.error) throw linkedRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const directExp = directRes.data || [];
      const linkedExp = (linkedRes.data || []).map(l => l.expense).filter(Boolean) as unknown as Expense[];

      // Deduplicate
      const expenseMap = new Map<string, Expense>();
      [...directExp, ...linkedExp].forEach(exp => {
        expenseMap.set(exp.id, exp);
      });

      const merged = Array.from(expenseMap.values()).sort((a, b) => 
        new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
      );

      setExpenses(merged);
      setAccounts(accountsRes.data || []);
      setContacts(contactsRes.data || []);
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [project.id]);

  const refetch = fetchExpenses;

  // Handle createSignal
  useEffect(() => {
    if (createSignal) {
      startAdding();
      if (onActionConsumed) onActionConsumed();
    }
  }, [createSignal]);

  const startAdding = () => {
    setFormData({
      direction: 'out',
      title: '',
      amount: '',
      currency: 'USD',
      category: 'Operation',
      selected_account_id: 'cash',
      counterparty_contact_id: '',
      expense_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: ''
    });
    setIsAdding(true);
    setIsQuickAddingContact(false);
  };

  const mapAccountToPaymentType = (account: any) => {
    if (!account) return 'other';
    const type = account.account_type?.toLowerCase() || '';
    if (type.includes('bank') || type.includes('checking') || type.includes('savings') || type === 'sub_account') return 'bank_transfer';
    if (type.includes('credit_card')) return 'credit_card';
    if (type.includes('debit_card')) return 'debit_card';
    if (type.includes('cash')) return 'cash';
    if (type.includes('crypto')) return 'crypto';
    return 'other';
  };

  const handleQuickAddContact = async () => {
    if (!quickContactData.name) {
      showToast.error('Contact name is required');
      return;
    }

    setLoadingForm(true);
    try {
      const { data, error } = await supabase
        .from('phonebook_contacts')
        .insert({
          user_id: project.user_id,
          business_id: project.business_id,
          name: quickContactData.name,
          contact_type: quickContactData.type,
          company_name: quickContactData.company || null,
          email: quickContactData.email || null,
          phone: quickContactData.phone || null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      showToast.success('Contact added to phonebook');
      
      // Refresh contacts list
      const { data: updatedContacts, error: fetchError } = await supabase
        .from('phonebook_contacts')
        .select('id, name, contact_type, company_name, email')
        .order('name');
      
      if (!fetchError && updatedContacts) {
        setContacts(updatedContacts);
      }

      // Select the new contact
      setFormData(prev => ({ ...prev, counterparty_contact_id: data.id }));
      setIsQuickAddingContact(false);
      setQuickContactData({
        name: '',
        type: 'other',
        company: '',
        email: '',
        phone: ''
      });
    } catch (err: any) {
      showToast.error('Failed to add contact: ' + err.message);
    } finally {
      setLoadingForm(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.amount) {
      showToast.error('Title and amount are required');
      return;
    }

    setLoadingForm(true);
    try {
      const selectedAccount = accounts.find(a => a.id === formData.selected_account_id);
      const isManual = formData.selected_account_id === 'cash';

      const { data: newExp, error } = await supabase.from('expenses').insert({
        user_id: project.user_id,
        business_id: project.business_id,
        project_id: project.id,
        direction: formData.direction,
        title: formData.title,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        category: formData.category,
        counterparty_contact_id: formData.counterparty_contact_id || null,
        financial_account_id: isManual ? null : formData.selected_account_id,
        payment_type: isManual ? 'cash' : mapAccountToPaymentType(selectedAccount),
        expense_date: formData.expense_date,
        status: formData.status,
        notes: formData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      
      showToast.success('Cashflow entry recorded');
      setIsAdding(false);
      refetch();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast.error('Failed to save expense: ' + err.message);
    } finally {
      setLoadingForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this financial record?',
      confirmLabel: 'Delete',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      refetch();
      if (onUpdate) onUpdate();
      showToast.success('Entry deleted');
    } catch (err: any) {
      showToast.error('Failed to delete entry: ' + err.message);
    }
  };

  const totalSpent = expenses?.reduce((sum, e) => e.direction === 'out' ? sum + e.amount : sum - e.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Project Expenses</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Financial records linked to this project</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-end">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-0.5">Total Net Burn</p>
            <p className={cn("text-lg font-bold uppercase", totalSpent > 0 ? "text-red-400" : "text-emerald-400")}>
              ${Math.abs(totalSpent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={startAdding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20 h-fit"
          >
            <Plus size={14} /> Add Entry
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setFormData({...formData, direction: 'out'})}
                  className={cn(
                    "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    formData.direction === 'out' ? "bg-red-500/20 border-red-500 text-red-400" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"
                  )}
                >
                  Expense (Out)
                </button>
                <button 
                  onClick={() => setFormData({...formData, direction: 'in'})}
                  className={cn(
                    "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    formData.direction === 'in' ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"
                  )}
                >
                  Income (In)
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Title</label>
              <input 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                required 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
                placeholder="Entry name..." 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Amount</label>
              <input 
                type="number"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})}
                required 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
                placeholder="0.00" 
              />
            </div>
            <div className="space-y-1.5">
  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Currency</label>
  <select
    value={formData.currency}
    onChange={e => setFormData({...formData, currency: e.target.value})}
    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
  >
    <option value="USD">USD</option>
    <option value="MXN">MXN</option>
    <option value="EUR">EUR</option>
    <option value="GBP">GBP</option>
  </select>
</div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Date</label>
              <input 
                type="date"
                value={formData.expense_date} 
                onChange={e => setFormData({...formData, expense_date: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Status</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="planned">Planned</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Category</label>
              <input 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none" 
                placeholder="Operation, Marketing, etc." 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Payment Account</label>
              <select 
                value={formData.selected_account_id} 
                onChange={e => setFormData({...formData, selected_account_id: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
              >
                <option value="cash">Cash / Manual</option>
                {accounts.map(account => {
                  const parentAccount = account.parent_id ? accounts.find(a => a.id === account.parent_id) : null;
                  const label = `${parentAccount ? parentAccount.name + ' > ' : ''}${account.name} (${account.currency || 'USD'})`;
                  return (
                    <option key={account.id} value={account.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Recipient</label>
              <button 
                onClick={() => setIsQuickAddingContact(!isQuickAddingContact)}
                className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 transition-colors"
              >
                <UserPlus size={10} /> {isQuickAddingContact ? 'Cancel' : 'Quick Add'}
              </button>
            </div>
            <select 
              value={formData.counterparty_contact_id} 
              onChange={e => setFormData({...formData, counterparty_contact_id: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none"
            >
              <option value="">None / Not Set</option>
              {contacts.map(contact => {
                const label = `${contact.name}${contact.contact_type ? ' — ' + contact.contact_type.charAt(0).toUpperCase() + contact.contact_type.slice(1) : ''}${contact.company_name ? ' (' + contact.company_name + ')' : ''}`;
                return (
                  <option key={contact.id} value={contact.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {isQuickAddingContact && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Contact Name</label>
                  <input 
                    value={quickContactData.name} 
                    onChange={e => setQuickContactData({...quickContactData, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none" 
                    placeholder="Full name..." 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={quickContactData.type} 
                    onChange={e => setQuickContactData({...quickContactData, type: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none"
                  >
                    <option value="client">Client</option>
                    <option value="supplier">Supplier</option>
                    <option value="contractor">Contractor</option>
                    <option value="partner">Partner</option>
                    <option value="bank">Bank</option>
                    <option value="developer">Developer</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="government">Government</option>
                    <option value="employee">Employee</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Company</label>
                  <input 
                    value={quickContactData.company} 
                    onChange={e => setQuickContactData({...quickContactData, company: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none" 
                    placeholder="Optional" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Email</label>
                  <input 
                    value={quickContactData.email} 
                    onChange={e => setQuickContactData({...quickContactData, email: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none" 
                    placeholder="Optional" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest ml-1">Phone</label>
                  <input 
                    value={quickContactData.phone} 
                    onChange={e => setQuickContactData({...quickContactData, phone: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500 outline-none" 
                    placeholder="Optional" 
                  />
                </div>
              </div>
              <button
                onClick={handleQuickAddContact}
                className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98]"
              >
                Save Contact & Select
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Notes</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none min-h-[60px]" 
              placeholder="Internal record notes..." 
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loadingForm}
              className="flex-1 py-3 rounded-xl bg-white text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl"
            >
              {loadingForm ? 'Saving...' : 'Record Cashflow'}
            </button>
            <button
              onClick={() => setIsAdding(false)}
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
            <DollarSign className="animate-spin text-white/10" />
          </div>
        ) : expenses?.length === 0 ? (
          <div className="py-12 bg-white/5 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center opacity-40">
            <DollarSign size={32} className="mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No expenses linked to this project</p>
          </div>
        ) : (
          expenses?.map(expense => (
            <div key={expense.id} className="group bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl flex items-center justify-center",
                    expense.direction === 'out' ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                  )}>
                    {expense.direction === 'out' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors line-clamp-1">{expense.title}</h5>
                    <div className="flex items-center gap-2 mt-1.5 font-bold uppercase tracking-widest text-[9px]">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/40">
                        <Tag size={8} />
                        {expense.category || 'Uncategorized'}
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/40">
                        <Calendar size={8} />
                        {new Date(expense.expense_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={cn("text-lg font-black uppercase tracking-tight", expense.direction === 'out' ? "text-red-400" : "text-emerald-400")}>
                      {expense.direction === 'out' ? '-' : '+'}${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-0.5">
                      {expense.account?.name || 'Cash / Manual'} • {expense.contact?.name || 'No Recipient'}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(expense.id)} className="p-2 text-white/30 hover:text-red-400 transition-colors opacity-40 md:opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expense.description && (
                <p className="text-[10px] text-white/30 italic mt-4 px-1">{expense.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
