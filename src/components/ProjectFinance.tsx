import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet,
  TrendingDown,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Project, Expense } from '../types';
import { cn } from '../lib/utils';

interface ProjectFinanceProps {
  project: Project;
}

export default function ProjectFinance({ project }: ProjectFinanceProps) {
  // Fetch expenses directly linked or through many-to-many
  const { data: directExpenses } = useSupabaseQuery<Expense[]>(
    () => supabase.from('expenses').select('*, account:financial_accounts(name)').eq('project_id', project.id),
    [project.id]
  );
  
  const { data: linkedExpenses } = useSupabaseQuery<any[]>(
    () => supabase.from('expense_project_links').select('expense:expenses(*, account:financial_accounts(name))').eq('project_id', project.id),
    [project.id]
  );

  const allExpenses = [
    ...(directExpenses || []),
    ...(linkedExpenses?.map(l => l.expense).filter(e => e.project_id !== project.id) || [])
  ].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

  const totals = allExpenses.reduce((acc, curr) => {
    if (curr.direction === 'in') acc.in += curr.amount;
    else acc.out += curr.amount;
    return acc;
  }, { in: 0, out: 0 });

  const net = totals.in - totals.out;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Financial Context</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Cashflow linked to this project</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={16} />
            </div>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Money In</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">USD {totals.in.toFixed(2)}</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
              <TrendingDown size={16} />
            </div>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Money Out</span>
          </div>
          <p className="text-2xl font-black text-white">USD {totals.out.toFixed(2)}</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wallet size={64} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Receipt size={16} />
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Net Cashflow</span>
            </div>
            <p className={cn(
              "text-2xl font-black",
              net >= 0 ? "text-blue-400" : "text-white"
            )}>USD {net.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Recent Project Transactions</span>
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">{allExpenses.length} Entries</span>
        </div>
        <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
          {allExpenses.map((expense) => (
            <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-lg border",
                  expense.direction === 'in' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                )}>
                  {expense.direction === 'in' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white uppercase">{expense.title}</p>
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">{new Date(expense.expense_date).toLocaleDateString()} • {expense.account?.name || 'Cash'}</p>
                </div>
              </div>
              <p className={cn(
                "text-[11px] font-black",
                expense.direction === 'in' ? "text-emerald-400" : "text-white"
              )}>
                {expense.direction === 'in' ? '+' : '-'}{expense.amount.toFixed(2)}
              </p>
            </div>
          ))}
          {allExpenses.length === 0 && (
            <div className="p-12 text-center opacity-20">
              <Receipt size={32} className="mx-auto mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest">No financial data for this project</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
