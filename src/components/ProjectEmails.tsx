import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Mail, 
  ExternalLink,
  ChevronRight,
  User,
  Clock,
  Layout
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Project, Email } from '../types';
import { cn } from '../lib/utils';

interface ProjectEmailsProps {
  project: Project;
}

export default function ProjectEmails({ project }: ProjectEmailsProps) {
  const [emails, setEmails] = React.useState<Email[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const [directRes, linkedRes] = await Promise.all([
        supabase
          .from('emails')
          .select('*, account:email_accounts(id,email_address,provider,display_color,display_name,display_icon)')
          .eq('linked_project_id', project.id),
        supabase
          .from('email_project_links')
          .select('email:emails(*, account:email_accounts(id,email_address,provider,display_color,display_name,display_icon))')
          .eq('project_id', project.id)
      ]);

      if (directRes.error) throw directRes.error;
      if (linkedRes.error) throw linkedRes.error;

      const directEmails = directRes.data || [];
      const linkedEmails = (linkedRes.data || []).map(l => (l as any).email).filter(Boolean) as Email[];

      // Deduplicate
      const emailMap = new Map<string, Email>();
      [...directEmails, ...linkedEmails].forEach(email => {
        emailMap.set(email.id, email);
      });

      const merged = Array.from(emailMap.values()).sort((a, b) => 
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );

      setEmails(merged);
    } catch (err: any) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEmails();
  }, [project.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Project Emails</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Communications linked to this project</p>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-8 flex justify-center">
            <Mail className="animate-spin text-white/10" />
          </div>
        ) : emails?.length === 0 ? (
          <div className="py-12 bg-white/5 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center opacity-40">
            <Mail size={32} className="mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No emails linked to this project</p>
          </div>
        ) : (
          emails?.map(email => (
            <div key={email.id} className="group bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">{email.subject}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                        <User size={8} className="text-white/20" />
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">{email.sender}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                        <Clock size={8} className="text-white/20" />
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">{new Date(email.received_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em]",
                    email.status === 'new' ? "bg-blue-500/10 text-blue-400" :
                    email.status === 'handled' ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-white/20"
                  )}>
                    {email.status}
                  </span>
                </div>
              </div>

              {email.snippet && (
                <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 px-1 mb-4">{email.snippet}</p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: email.account?.display_color || '#3b82f6' }} />
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{email.account?.email_address}</span>
                </div>
                <Link 
                  to="/emails"
                  className="flex items-center gap-1 text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors cursor-pointer"
                >
                  View Details <ChevronRight size={10} />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
