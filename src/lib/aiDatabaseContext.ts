import { supabase } from './supabaseClient';
import { sanitizeAIContext } from './aiSecurity';

function truncateText(text: string | null, limit: number = 300): string {
  if (!text) return '';
  if (text.length <= limit) return text;
  return text.substring(0, limit) + '...';
}

export async function buildAIDatabaseContext(userId: string, isDetailed: boolean = false): Promise<{ context: string, errors: string[], timestamp: number, sensitiveValues: string[] }> {
  const errors: string[] = [];
  const timestamp = Date.now();
  const sensitiveValues: Set<string> = new Set();
  
  // ... (limits and fetchData remain the same)
  const limits = isDetailed ? {
    projects: 100,
    tasks: 100,
    emails: 50,
    activity: 50
  } : {
    projects: 25,
    tasks: 25,
    emails: 20,
    activity: 15
  };

  const fetchData = async (table: string, query: any) => {
    try {
      const { data, error } = await query;
      if (error) {
        errors.push(`${table}: ${error.message}`);
        return null;
      }
      return data;
    } catch (err: any) {
      errors.push(`${table}: ${err.message}`);
      return null;
    }
  };

  const [
    profile,
    businesses,
    platforms,
    projects,
    tasks,
    email_accounts,
    emails,
    daily_plans,
    activity_logs,
    ai_settings,
    project_items,
    phonebook_contacts,
    financial_accounts,
    expenses,
    email_project_links,
    expense_project_links,
    calendar_accounts,
    calendar_events
  ] = await Promise.all([
    fetchData('profiles', supabase.from('profiles').select('*').eq('id', userId).maybeSingle()),
    fetchData('businesses', supabase.from('businesses').select('*').eq('user_id', userId).limit(50)),
    fetchData('platforms', supabase.from('platforms').select('*, business:businesses(name)').eq('user_id', userId).limit(50)),
    fetchData('projects', supabase.from('projects').select('*, business:businesses(name), platform:platforms(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.projects)),
    fetchData('tasks', supabase.from('tasks').select('*, business:businesses(name), project:projects(name), platform:platforms(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.tasks)),
    fetchData('email_accounts', supabase.from('email_accounts').select('id,email_address,provider,status,last_synced_at,business:businesses(name)').eq('user_id', userId).limit(20)),
    fetchData('emails', supabase.from('emails').select('subject, sender, received_at, status, is_read, snippet, project:projects!linked_project_id(name), platform:platforms!linked_platform_id(name)').eq('user_id', userId).order('received_at', { ascending: false }).limit(limits.emails)),
    fetchData('daily_plans', supabase.from('daily_plans').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7)),
    fetchData('activity_logs', supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.activity)),
    fetchData('ai_settings', supabase.from('ai_settings').select('*').eq('user_id', userId).maybeSingle()),
    fetchData('project_items', supabase.from('project_items').select('*, project:projects(name)').eq('user_id', userId).limit(50)),
    fetchData('phonebook_contacts', supabase.from('phonebook_contacts').select('*, business:businesses(name)').eq('user_id', userId).limit(50)),
    fetchData('financial_accounts', supabase.from('financial_accounts').select('*, business:businesses(name)').eq('user_id', userId).limit(20)),
    fetchData('expenses', supabase.from('expenses').select('*, business:businesses(name), project:projects(name), account:financial_accounts(name), contact:phonebook_contacts(name), project_item:project_items(name)').eq('user_id', userId).order('expense_date', { ascending: false }).limit(50)),
    fetchData('email_project_links', supabase.from('email_project_links').select('email_id, project:projects(name)').eq('user_id', userId)),
    fetchData('expense_project_links', supabase.from('expense_project_links').select('expense_id, project:projects(name)').eq('user_id', userId)),
    fetchData('calendar_accounts', supabase.from('calendar_accounts').select('*').eq('user_id', userId).limit(50)),
    fetchData('calendar_events', supabase.from('calendar_events').select('*, account:calendar_accounts(email_address, display_name)').eq('user_id', userId).limit(100))
  ]);

  // Helper to add to sensitive values
  const addSensitive = (val: any) => {
    if (typeof val === 'string' && val.length > 5) {
      sensitiveValues.add(val);
    }
  };

  platforms?.forEach((p: any) => addSensitive(p.login_notes));
  businesses?.forEach((b: any) => addSensitive(b.tax_id));
  phonebook_contacts?.forEach((c: any) => {
    addSensitive(c.email);
    addSensitive(c.phone);
    addSensitive(c.tax_id);
    addSensitive(c.address);
  });
  email_accounts?.forEach((a: any) => addSensitive(a.email_address));
  calendar_accounts?.forEach((a: any) => addSensitive(a.email_address));

  const rawContextData: any = {
    metadata: {
      generated_at: new Date(timestamp).toISOString(),
      counts: {
        businesses: businesses?.length || 0,
        platforms: platforms?.length || 0,
        projects: projects?.length || 0,
        project_items: project_items?.length || 0,
        tasks: tasks?.length || 0,
        emails: emails?.length || 0,
        daily_plans: daily_plans?.length || 0,
        expenses: expenses?.length || 0,
        contacts: phonebook_contacts?.length || 0,
        accounts: financial_accounts?.length || 0,
        calendar_accounts: calendar_accounts?.length || 0,
        calendar_events: calendar_events?.length || 0
      }
    },
    ai_settings: ai_settings ? { 
      model: ai_settings.model_name, 
      enabled: ai_settings.enabled,
      allow_sensitive_context: ai_settings.allow_sensitive_context,
      endpoint: ai_settings.ollama_endpoint ? 'configured' : 'missing'
    } : null,
    profile: profile ? { name: profile.full_name, email: profile.email } : null,
    businesses: businesses?.map((b: any) => ({ 
      name: b.name, 
      region: b.region, 
      status: b.status,
      tax_id: b.tax_id,
      website: b.website_url,
      inc_date: b.incorporation_date,
      notes: truncateText(b.notes, 150)
    })),
    platforms: platforms?.map((p: any) => ({ 
      name: p.name, 
      category: p.category, 
      status: p.status,
      business: p.business?.name,
      has_notes: !!p.notes,
      has_login_notes: !!p.login_notes,
      login_notes: p.login_notes, // Will be sanitized later
      notes: truncateText(p.notes, 150)
    })),
    projects: projects?.map((p: any) => ({ 
      name: p.name, 
      status: p.status, 
      priority: p.priority, 
      progress: p.progress, 
      deadline: p.deadline,
      business: p.business?.name,
      platform: p.platform?.name,
      budget: p.budget,
      next_action: truncateText(p.next_action, 150),
      description: truncateText(p.description, 200),
      notes: truncateText(p.notes, 150)
    })),
    project_items: project_items?.map((item: any) => ({
      name: item.name,
      type: item.item_type,
      status: item.status,
      priority: item.priority,
      project: item.project?.name,
      sku: item.sku,
      url: item.url,
      description: truncateText(item.description, 200),
      notes: truncateText(item.notes, 150)
    })),
    tasks: tasks?.map((t: any) => ({ 
      title: t.title, 
      status: t.status, 
      priority: t.priority, 
      due_date: t.due_date,
      work_date: t.work_date,
      ai_score: t.ai_priority_score,
      business: t.business?.name,
      project: t.project?.name,
      platform: t.platform?.name,
      description: truncateText(t.description, 200),
      recurring: t.recurring_type,
      notes: truncateText(t.notes, 150)
    })),
    expenses: expenses?.map((e: any) => ({
      title: e.title,
      direction: e.direction,
      amount: e.amount,
      currency: e.currency,
      status: e.status,
      date: e.expense_date,
      category: e.category,
      payment_type: e.payment_type,
      business: e.business?.name,
      primary_project: e.project?.name,
      all_projects: (expense_project_links as any[])?.filter(l => l.expense_id === e.id).map(l => l.project?.name),
      project_item: e.project_item?.name,
      account: e.account?.name,
      contact: e.contact?.name,
      notes: truncateText(e.notes, 150)
    })),
    accounts: financial_accounts?.map((a: any) => ({
      name: a.name,
      type: a.account_type,
      currency: a.currency,
      institution: a.institution_name,
      business: a.business?.name,
      status: a.status
    })),
    contacts: phonebook_contacts?.map((c: any) => ({
      name: c.name,
      type: c.contact_type,
      company: c.company_name,
      business: c.business?.name,
      email: c.email,
      phone: c.phone,
      tax_id: c.tax_id,
      address: c.address
    })),
    email_accounts: email_accounts?.map((a: any) => ({ 
      email: a.email_address, 
      provider: a.provider,
      business: a.business?.name 
    })),
    emails: emails?.map((e: any) => ({ 
      subject: e.subject, 
      sender: e.sender, 
      status: e.status, 
      is_read: e.is_read,
      received_at: e.received_at,
      snippet: truncateText(e.snippet, 200),
      primary_project: e.project?.name,
      all_projects: (email_project_links as any[])?.filter(l => l.email_id === e.id).map(l => l.project?.name),
      platform: e.platform?.name
    })),
    daily_plans: daily_plans?.map((d: any) => ({ 
      date: d.date, 
      morning_plan: truncateText(d.morning_plan, 200),
      top_priorities: d.top_priorities,
      time_blocks: d.time_blocks ? truncateText(JSON.stringify(d.time_blocks), 200) : null,
      end_day_review: truncateText(d.end_day_review, 200),
      notes: truncateText(d.notes, 150)
    })),
    calendar_accounts: calendar_accounts?.map((a: any) => ({
      email: a.email_address,
      provider: a.provider,
      status: a.status,
      display_name: a.display_name
    })),
    calendar_events: calendar_events?.map((e: any) => ({
      title: e.title,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      location: e.location,
      status: e.status,
      account_email: e.account?.email_address,
      account_name: e.account?.display_name
    })),
    recent_activity: activity_logs?.map((a: any) => ({ 
      action: a.action, 
      entity: a.entity_type, 
      timestamp: a.created_at,
      details: a.details ? truncateText(JSON.stringify(a.details), 100) : null
    })),
    context_errors: errors.length > 0 ? errors : undefined
  };

  const contextData = sanitizeAIContext(rawContextData, ai_settings);

  return {
    context: JSON.stringify(contextData, null, 2),
    errors,
    timestamp,
    sensitiveValues: Array.from(sensitiveValues)
  };
}
