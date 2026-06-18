import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  FileText, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { useUser } from '../hooks/useUser';
import { useUI } from '../contexts/UIContext';
import { PhonebookContact, Business } from '../types';
import CreateModal from '../components/CreateModal';

export default function Phonebook() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { confirm, showToast } = useUI();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBusiness, setFilterBusiness] = useState<string>('all');
  
  const [contactModal, setContactModal] = useState<{ 
    isOpen: boolean; 
    mode: 'create' | 'edit' | 'view'; 
    contact: PhonebookContact | null 
  }>({
    isOpen: false,
    mode: 'create',
    contact: null
  });

  // Queries
  const { data: contacts, loading, refetch } = useSupabaseQuery<PhonebookContact[]>(
    () => supabase
      .from('phonebook_contacts')
      .select('*, business:businesses(id, name)')
      .order('name', { ascending: true }),
    []
  );

  const { data: businesses } = useSupabaseQuery<Business[]>(
    () => supabase.from('businesses').select('id, name').order('name'),
    []
  );

  const handleContactSubmit = async (data: any) => {
    if (!user) return;
    try {
      // Parse JSON safely
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
      
      const contactData = {
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

      if (!contactData.name) throw new Error('Contact name is required.');

      if (contactModal.mode === 'create') {
        const { data: newContact, error } = await supabase.from('phonebook_contacts').insert({
          ...contactData,
          user_id: user.id,
          created_at: new Date().toISOString()
        }).select().single();
        
        if (error) throw error;

        // Log activity
        supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'create',
          entity_type: 'contact',
          entity_id: newContact.id,
          details: { name: contactData.name }
        });

      } else {
        const { error } = await supabase
          .from('phonebook_contacts')
          .update(contactData)
          .eq('id', contactModal.contact!.id);
        
        if (error) throw error;

        // Log activity
        supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'update',
          entity_type: 'contact',
          entity_id: contactModal.contact!.id,
          details: { name: contactData.name }
        });
      }

      refetch();
      setContactModal(prev => ({ ...prev, isOpen: false }));
      showToast.success(`Contact ${contactModal.mode === 'create' ? 'created' : 'updated'} successfully`);
    } catch (err: any) {
      showToast.error('Error: ' + err.message);
    }
  };

  const handleDeleteContact = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Contact',
      message: `Permanently delete ${name}? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('phonebook_contacts').delete().eq('id', id);
      if (error) throw error;
      
      supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'delete',
        entity_type: 'contact',
        entity_id: id,
        details: { name }
      });

      refetch();
      showToast.success('Contact deleted');
    } catch (err: any) {
      showToast.error('Delete failed: ' + err.message);
    }
  };

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = (contact.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (contact.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (contact.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || contact.contact_type === filterType;
    const matchesBusiness = filterBusiness === 'all' || contact.business_id === filterBusiness;
    
    return matchesSearch && matchesType && matchesBusiness;
  });

  const contactTypes = [
    'client', 'supplier', 'contractor', 'partner', 'bank', 
    'developer', 'employee', 'marketplace', 'government', 'other'
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em]">Network & Relationships</span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Phonebook</h2>
          <p className="text-white/40 text-sm mt-1">People, companies, banks, suppliers, clients, and personal contacts.</p>
        </div>
        
        <button 
          onClick={() => setContactModal({ isOpen: true, mode: 'create', contact: null })}
          className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-600/20 hover:bg-blue-500 group"
        >
          <Plus size={18} />
          Add Contact
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
          <input 
            type="text"
            placeholder="Search by name, email or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/10 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-1 flex-1 md:flex-initial flex justify-around md:justify-start">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white/60 px-4 py-2 outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="all">All Types</option>
              {contactTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="w-px bg-white/5 my-1" />
            <select
              value={filterBusiness}
              onChange={(e) => setFilterBusiness(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white/60 px-4 py-2 outline-none cursor-pointer hover:text-white transition-colors max-w-[150px]"
            >
              <option value="all">All Businesses</option>
              {businesses?.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredContacts?.map(contact => (
          <div 
            key={contact.id} 
            onClick={() => navigate(`/phonebook/${contact.id}`)}
            className="group bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-blue-500/30 transition-all hover:bg-white/[0.07] relative overflow-hidden cursor-pointer"
          >
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center text-white/40 font-black text-xl shadow-inner">
                {(contact.name || contact.company_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setContactModal({ isOpen: true, mode: 'edit', contact }); }} 
                  className="p-2.5 rounded-xl bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id, contact.name); }} 
                  className="p-2.5 rounded-xl bg-white/5 text-red-500/30 hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            <div className="mb-6 relative z-10">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-tight line-clamp-1">{contact.name}</h3>
                <ChevronRight size={14} className="text-white/10 group-hover:text-blue-500 transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/10 text-[8px] font-black text-blue-400 uppercase tracking-widest">
                  {contact.contact_type}
                </span>
                {contact.business && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/10 text-[8px] font-black text-emerald-400 uppercase tracking-widest max-w-[100px] truncate">
                    {contact.business.name}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5 relative z-10">
              {contact.company_name && (
                <div className="flex items-center gap-3">
                  <Building2 size={12} className="text-white/20 shrink-0" />
                  <span className="text-[10px] text-white/60 font-bold uppercase tracking-tight truncate">{contact.company_name}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail size={12} className="text-white/20 shrink-0" />
                  <span className="text-[10px] text-white/40 truncate">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={12} className="text-white/20 shrink-0" />
                  <span className="text-[10px] text-white/40">{contact.phone}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {!loading && filteredContacts?.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] opacity-20">
            <Users size={48} className="mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.4em]">No contacts found</p>
          </div>
        )}
      </div>

      <CreateModal
        isOpen={contactModal.isOpen}
        onClose={() => setContactModal(prev => ({ ...prev, isOpen: false }))}
        title={`${contactModal.mode === 'create' ? 'Add' : 'Edit'} Contact`}
        mode={contactModal.mode}
        onSubmit={handleContactSubmit}
        initialValues={contactModal.contact || {}}
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
            options: contactTypes.map(t => ({ label: t.toUpperCase(), value: t }))
          },
          {
            name: 'company_name',
            label: 'Company Name',
            type: 'text',
            placeholder: 'Optional company link'
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
    </div>
  );
}
