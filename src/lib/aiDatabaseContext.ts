import { supabase } from './supabaseClient';
import { sanitizeAIContext } from './aiSecurity';

function truncateText(text: string | null, limit: number = 300): string {
  if (!text) return '';
  if (text.length <= limit) return text;
  return text.substring(0, limit) + '...';
}

export async function buildAIDatabaseContext(userId: string, isDetailed: boolean = false, userMessage?: string): Promise<{ context: string, errors: string[], timestamp: number, sensitiveValues: string[] }> {
  const errors: string[] = [];
  const timestamp = Date.now();
  const sensitiveValues: Set<string> = new Set();
  
  let includeTasks = true;
  let includeEmails = true;
  let includeFinances = true;
  let includeSocial = true;
  let includeContacts = true;
  let includeAgentStatus = true;
  let isFiltered = false;

  if (userMessage) {
    const msg = userMessage.toLowerCase();
    
    const hasTasks = /\b(task|todo|to-do|project|plan|schedule|calendar|event|meeting|daily|morning|review|agenda|date|today|tomorrow|yesterday|week|month)\b/i.test(msg);
    const hasEmails = /\b(email|mail|inbox|subject|sender|folder|snippet|unread|received)\b/i.test(msg);
    const hasFinances = /\b(expense|budget|finance|financial|spent|cost|money|account|transaction|paid|payment|dollar|usd|invoice|bill)\b/i.test(msg);
    const hasSocial = /\b(post|social|facebook|linkedin|twitter|instagram|outreach|publish|draft|feed|approval)\b/i.test(msg);
    const hasContacts = /\b(contact|phone|call|address|directory|person|people|friend|client|customer|member|user|business|platform|company)\b/i.test(msg);
    const hasAgentStatus = /\b(agent|run|usage|limit|price|cost|spend|error|status|log|activity|action)\b/i.test(msg);

    // If at least one category was specifically asked, we apply filtering!
    if (hasTasks || hasEmails || hasFinances || hasSocial || hasContacts || hasAgentStatus) {
      includeTasks = hasTasks;
      includeEmails = hasEmails;
      includeFinances = hasFinances;
      includeSocial = hasSocial;
      includeContacts = hasContacts;
      includeAgentStatus = hasAgentStatus;
      isFiltered = true;
    }
  }

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
    email_folders,
    activity_logs,
    ai_settings,
    project_items,
    phonebook_contacts,
    financial_accounts,
    expenses,
    email_project_links,
    expense_project_links,
    calendar_accounts,
    calendar_events,
    integration_accounts,
    social_profiles,
    social_posts,
    approval_requests,
    agent_tasks,
    ai_usage_events,
    ai_agent_runs,
    ai_usage_limits,
    ai_model_prices
  ] = await Promise.all([
    fetchData('profiles', supabase.from('profiles').select('*').eq('id', userId).maybeSingle()),
    includeContacts ? fetchData('businesses', supabase.from('businesses').select('*').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeContacts ? fetchData('platforms', supabase.from('platforms').select('*, business:businesses(name)').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeTasks ? fetchData('projects', supabase.from('projects').select('*, business:businesses(name), platform:platforms(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.projects)) : Promise.resolve(null),
    includeTasks ? fetchData('tasks', supabase.from('tasks').select('*, business:businesses(name), project:projects(name), platform:platforms(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.tasks)) : Promise.resolve(null),
    includeEmails ? fetchData('email_accounts', supabase.from('email_accounts').select('id,email_address,provider,status,last_synced_at,business:businesses(name)').eq('user_id', userId).limit(20)) : Promise.resolve(null),
    includeEmails ? fetchData('emails', supabase.from('emails').select('id, account_id, folder_id, linked_project_id, linked_platform_id, tags, ai_summary, ai_suggested_task_title, subject, sender, received_at, status, is_read, snippet, project:projects!linked_project_id(name), platform:platforms!linked_platform_id(name)').eq('user_id', userId).order('received_at', { ascending: false }).limit(limits.emails)) : Promise.resolve(null),
    includeTasks ? fetchData('daily_plans', supabase.from('daily_plans').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7)) : Promise.resolve(null),
    includeEmails ? fetchData('email_folders', supabase.from('email_folders').select('id, name, email_account_id, folder_type').eq('user_id', userId)) : Promise.resolve(null),
    includeAgentStatus ? fetchData('activity_logs', supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limits.activity)) : Promise.resolve(null),
    fetchData('ai_settings', supabase.from('ai_settings').select('*').eq('user_id', userId).maybeSingle()),
    includeTasks ? fetchData('project_items', supabase.from('project_items').select('*, project:projects(name)').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeContacts ? fetchData('phonebook_contacts', supabase.from('phonebook_contacts').select('*, business:businesses(name)').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeFinances ? fetchData('financial_accounts', supabase.from('financial_accounts').select('*, business:businesses(name)').eq('user_id', userId).limit(20)) : Promise.resolve(null),
    includeFinances ? fetchData('expenses', supabase.from('expenses').select('*, business:businesses(name), project:projects(name), account:financial_accounts(name), contact:phonebook_contacts(name), project_item:project_items(name)').eq('user_id', userId).order('expense_date', { ascending: false }).limit(50)) : Promise.resolve(null),
    includeEmails ? fetchData('email_project_links', supabase.from('email_project_links').select('email_id, project:projects(name)').eq('user_id', userId)) : Promise.resolve(null),
    includeFinances ? fetchData('expense_project_links', supabase.from('expense_project_links').select('expense_id, project:projects(name)').eq('user_id', userId)) : Promise.resolve(null),
    includeTasks ? fetchData('calendar_accounts', supabase.from('calendar_accounts').select('*').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeTasks ? fetchData('calendar_events', supabase.from('calendar_events').select('*, account:calendar_accounts(email_address, display_name)').eq('user_id', userId).gte('start_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).order('start_at', { ascending: true }).limit(100)) : Promise.resolve(null),
    includeSocial ? fetchData('integration_accounts', supabase.from('integration_accounts').select('id, provider, status').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeSocial ? fetchData('social_profiles', supabase.from('social_profiles').select('id, provider, handle, display_name, follower_count').eq('user_id', userId).limit(50)) : Promise.resolve(null),
    includeSocial ? fetchData('social_posts', supabase.from('social_posts').select('id, provider, title, status, scheduled_at').eq('user_id', userId).neq('status', 'published').limit(50)) : Promise.resolve(null),
    includeSocial ? fetchData('approval_requests', supabase.from('approval_requests').select('id, entity_type, action_type, status').eq('user_id', userId).eq('status', 'pending').limit(50)) : Promise.resolve(null),
    includeAgentStatus ? fetchData('agent_tasks', supabase.from('agent_tasks').select('id, task_type, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)) : Promise.resolve(null),
    includeAgentStatus ? fetchData('ai_usage_events', supabase.from('ai_usage_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)) : Promise.resolve(null),
    includeAgentStatus ? fetchData('ai_agent_runs', supabase.from('ai_agent_runs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)) : Promise.resolve(null),
    includeAgentStatus ? fetchData('ai_usage_limits', supabase.from('ai_usage_limits').select('*').eq('user_id', userId).maybeSingle()) : Promise.resolve(null),
    fetchData('ai_model_prices', supabase.from('ai_model_prices').select('*'))
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

  const integrationsCountByProvider: Record<string, number> = {};
  integration_accounts?.forEach((acc: any) => {
    if (acc && acc.provider) {
      integrationsCountByProvider[acc.provider] = (integrationsCountByProvider[acc.provider] || 0) + 1;
    }
  });

  const compactProfiles = social_profiles?.map((p: any) => ({
    handle: p.handle || p.display_name || '',
    provider: p.provider,
    followers: p.follower_count || 0
  })) || [];

  const draftPosts = social_posts?.map((p: any) => ({
    provider: p.provider,
    title: p.title || 'Untitled',
    status: p.status,
    scheduled_at: p.scheduled_at
  })) || [];

  const pendingApprovals = approval_requests?.map((a: any) => ({
    id: a.id,
    entity_type: a.entity_type,
    action_type: a.action_type
  })) || [];

  const recentAgentTasks = agent_tasks?.map((t: any) => ({
    id: t.id,
    task_type: t.task_type,
    status: t.status
  })) || [];

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
        calendar_events: calendar_events?.length || 0,
        integration_accounts: integration_accounts?.length || 0,
        social_profiles: social_profiles?.length || 0,
        social_posts: social_posts?.length || 0,
        approval_requests: approval_requests?.length || 0,
        agent_tasks: agent_tasks?.length || 0
      }
    },
    integrations_summary: {
      provider_accounts_count: integrationsCountByProvider,
      social_profiles: compactProfiles,
      non_published_posts: draftPosts,
      pending_approvals: pendingApprovals,
      recent_agent_tasks: recentAgentTasks
    },
    ai_settings: ai_settings ? { 
      model: ai_settings.model_name, 
      enabled: ai_settings.enabled,
      allow_sensitive_context: ai_settings.allow_sensitive_context,
      endpoint: ai_settings.ollama_endpoint ? 'configured' : 'missing'
    } : null,
    profile: profile ? { name: profile.full_name, email: profile.email, timezone: profile.timezone } : null,
    businesses: businesses?.map((b: any) => ({
      id: b.id,
      name: b.name, 
      region: b.region, 
      status: b.status,
      tax_id: b.tax_id,
      website: b.website_url,
      inc_date: b.incorporation_date,
      notes: truncateText(b.notes, 150)
    })),
    platforms: platforms?.map((p: any) => ({
      id: p.id,
      business_id: p.business_id,
      name: p.name, 
      category: p.category, 
      status: p.status,
      business: p.business?.name,
      has_notes: !!p.notes,
      has_login_notes: !!p.login_notes,
      login_notes: p.login_notes,
      notes: truncateText(p.notes, 150)
    })),
    projects: projects?.map((p: any) => ({ 
      id: p.id,
      business_id: p.business_id,
      platform_id: p.platform_id,
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
      id: item.id,
      project_id: item.project_id,
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
      id: t.id,
      business_id: t.business_id,
      project_id: t.project_id,
      platform_id: t.platform_id,
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
      id: e.id,
      business_id: e.business_id,
      project_id: e.project_id,
      financial_account_id: e.financial_account_id,
      counterparty_contact_id: e.counterparty_contact_id,
      status: e.status,
      title: e.title,
      direction: e.direction,
      amount: e.amount,
      currency: e.currency,
      date: e.expense_date,
      category: e.category,
      payment_type: e.payment_type,
      receipt_url: e.receipt_url,
      notes: truncateText(e.notes, 150)
    })),
    accounts: financial_accounts?.map((a: any) => ({
      id: a.id,
      parent_id: a.parent_id,
      name: a.name,
      type: a.account_type,
      current_balance: a.current_balance,
      currency: a.currency,
      institution: a.institution_name,
      business: a.business?.name,
      status: a.status
    })),
    contacts: phonebook_contacts?.map((c: any) => ({
      id: c.id,
      business_id: c.business_id,
      name: c.name,
      type: c.contact_type,
      company: c.company_name,
      business: c.business?.name,
      email: c.email,
      phone: c.phone,
      notes: truncateText(c.notes, 150)
    })),
    email_accounts: email_accounts?.map((a: any) => ({ 
      id: a.id,
      email: a.email_address, 
      provider: a.provider,
      business: a.business?.name 
    })),
    email_folders: email_folders?.map((f: any) => ({
      id: f.id,
      name: f.name,
      account_id: f.email_account_id,
      folder_type: f.folder_type
    })),
    emails: emails?.map((e: any) => ({
      id: e.id,
      account_id: e.account_id,
      folder_id: e.folder_id,
      linked_project_id: e.linked_project_id,
      linked_platform_id: e.linked_platform_id,
      tags: e.tags,
      ai_summary: e.ai_summary,
      ai_suggested_task_title: e.ai_suggested_task_title,
      subject: e.subject, 
      sender: e.sender, 
      status: e.status, 
      is_read: e.is_read,
      received_at: e.received_at,
      snippet: truncateText(e.snippet, 200),
      primary_project: e.project?.name
    })),
    daily_plans: daily_plans?.map((d: any) => ({ 
      id: d.id,
      date: d.date, 
      morning_plan: truncateText(d.morning_plan, 200),
      top_priorities: d.top_priorities,
      time_blocks: d.time_blocks ? truncateText(JSON.stringify(d.time_blocks), 200) : null,
      end_day_review: truncateText(d.end_day_review, 200),
      notes: truncateText(d.notes, 150)
    })),
    calendar_accounts: calendar_accounts?.map((a: any) => ({
      id: a.id,
      email: a.email_address,
      provider: a.provider,
      status: a.status,
      display_name: a.display_name
    })),
    calendar_events: calendar_events?.map((e: any) => ({
      id: e.id,
      calendar_account_id: e.calendar_account_id,
      title: e.title,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      location: e.location,
      status: e.status
    })),
    spending_summary: {
      recent_runs: ai_agent_runs?.slice(0, 10).map((r: any) => ({ id: r.id, status: r.status, model: r.model_name, cost: r.estimated_cost_usd })),
      limits: ai_usage_limits ? { daily: ai_usage_limits.daily_budget_usd, monthly: ai_usage_limits.monthly_budget_usd } : null,
      usage_metrics: ai_usage_events?.slice(0, 10).map((u: any) => ({ agent: u.agent_id, provider: u.provider, cost: u.estimated_cost_usd }))
    },
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
