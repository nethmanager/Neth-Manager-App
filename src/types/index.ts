export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'backlog' | 'today' | 'in_progress' | 'waiting' | 'done' | 'cancelled';
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type ProjectCategory = 'business' | 'personal' | 'home' | 'health' | 'finance' | 'legal' | 'family' | 'learning' | 'travel' | 'other';
export type EmailStatus = 'new' | 'needs_action' | 'waiting' | 'handled' | 'archived';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  region: 'US' | 'Mexico';
  status: 'active' | 'inactive' | 'archived';
  tax_id: string | null;
  incorporation_date: string | null;
  legal_address: string | null;
  website_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Platform {
  id: string;
  user_id: string;
  business_id: string | null;
  name: string;
  category: string;
  url: string | null;
  status: 'active' | 'warning' | 'inactive' | 'archived';
  login_notes: string | null;
  last_checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  business?: { name: string };
}

export interface Project {
  id: string;
  user_id: string;
  business_id: string | null;
  platform_id: string | null;
  name: string;
  category: ProjectCategory;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  deadline: string | null;
  budget: number | null;
  progress: number;
  ai_summary: string | null;
  next_action: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  business?: { name: string };
  platform?: { name: string };
}

export interface Task {
  id: string;
  user_id: string;
  business_id: string | null;
  project_id: string | null;
  platform_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  work_date: string | null;
  recurring_type: string | null;
  recurring_config: any | null;
  email_link: string | null;
  ai_priority_score: number | null;
  ai_suggested_next_step: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  business?: { name: string };
  project?: { name: string };
  platform?: { name: string };
}

export interface EmailAccount {
  id: string;
  user_id: string;
  business_id: string | null;
  email_address: string;
  provider: string;
  provider_account_id?: string;
  last_synced_at?: string;
  display_color: string;
  display_icon: string | null;
  display_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EmailFolder {
  id: string;
  user_id: string;
  email_account_id: string | null;
  name: string;
  provider_label_id: string | null;
  color: string | null;
  folder_type: 'inbox' | 'sent' | 'draft' | 'trash' | 'custom' | 'archived';
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailRoutingRule {
  id: string;
  user_id: string;
  email_account_id: string | null;
  folder_id: string;
  name: string;
  match_type: 'contains' | 'equals' | 'starts_with' | 'regex';
  field: 'sender' | 'subject' | 'snippet' | 'body_text' | 'tags';
  pattern: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  folder?: EmailFolder;
}

export interface Email {
  id: string;
  user_id: string;
  account_id: string | null;
  folder_id: string | null;
  sender: string;
  recipient: string;
  subject: string;
  snippet: string | null;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
  status: EmailStatus;
  ai_summary: string | null;
  ai_suggested_reply: string | null;
  ai_importance_score: number | null;
  ai_importance_reason: string | null;
  ai_suggested_task_title: string | null;
  ai_suggested_task_id: string | null;
  ai_suggested_folder_name?: string | null;
  ai_suggested_folder_confidence?: number | null;
  ai_suggested_folder_reason?: string | null;
  linked_project_id: string | null;
  linked_platform_id: string | null;
  provider_message_id?: string;
  provider_thread_id?: string;
  provider_labels?: string[];
  tags: string[];
  ai_suggested_tags: string[];
  raw_payload?: any;
  created_at: string;

  // Joined fields
  account?: EmailAccount;
  folder?: EmailFolder;
  project?: { name: string };
  platform?: { name: string };
}

export interface DailyPlan {
  id: string;
  user_id: string;
  date: string;
  morning_plan: string | null;
  top_priorities: string[] | null;
  time_blocks: any | null;
  end_day_review: string | null;
  notes: string | null;
  ai_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AISettings {
  user_id: string;
  enabled: boolean;
  ollama_endpoint: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  allow_sensitive_context: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectFile {
  id: string;
  user_id: string;
  project_id: string;
  project_item_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  tags: string[];
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any | null;
  created_at: string;
}

export interface EmailProjectLink {
  id: string;
  user_id: string;
  email_id: string;
  project_id: string;
  created_at: string;
  
  // Joined fields
  project?: Project;
}

export interface ProjectItem {
  id: string;
  user_id: string;
  business_id: string;
  project_id: string;
  name: string;
  item_type: string | null;
  status: string | null;
  priority: string | null;
  description: string | null;
  sku: string | null;
  url: string | null;
  notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface PhonebookContact {
  id: string;
  user_id: string;
  business_id: string | null;
  name: string;
  contact_type: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  tax_id: string | null;
  address: string | null;
  notes: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  business?: { id: string, name: string };
}

export interface FinancialAccount {
  id: string;
  user_id: string;
  business_id: string | null;
  parent_id: string | null;
  name: string;
  account_type: string;
  institution_name: string | null;
  currency: string;
  account_number_last4: string | null;
  routing_number: string | null;
  account_number: string | null;
  swift_bic: string | null;
  bank_code: string | null;
  opening_balance: number;
  current_balance: number;
  status: string;
  notes: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  business?: { name: string };
  businesses?: { id: string, business: { id: string, name: string } }[];
  multi_businesses?: string[];
  parent?: { name: string };
  sub_accounts?: FinancialAccount[];
}

export interface Expense {
  id: string;
  user_id: string;
  business_id: string | null;
  project_id: string | null;
  project_item_id: string | null;
  financial_account_id: string | null;
  counterparty_contact_id: string | null;
  direction: 'in' | 'out';
  title: string;
  amount: number;
  currency: string;
  tax_amount: number | null;
  payment_type: string | null;
  category: string | null;
  subcategory: string | null;
  status: string;
  expense_date: string;
  due_date: string | null;
  settled_at: string | null;
  reference_number: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurring_config: any | null;
  description: string | null;
  notes: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  business?: { name: string };
  project?: { name: string };
  project_item?: { name: string };
  account?: { name: string };
  contact?: { name: string };
}

export interface ExpenseProjectLink {
  id: string;
  user_id: string;
  expense_id: string;
  project_id: string;
  created_at: string;

  // Joined fields
  project?: Project;
}

export interface CalendarAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  email_address: string;
  display_name: string | null;
  display_color: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  calendar_account_id: string;
  provider: string;
  provider_calendar_id: string;
  provider_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: string;
  html_link: string | null;
  attendees: any | null;
  raw_payload: any | null;
  created_at: string;
  updated_at: string;
  account?: CalendarAccount;
}

export interface ExpenseReceipt {
  id: string;
  user_id: string;
  expense_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface ContactProjectLink {
  id: string;
  user_id: string;
  contact_id: string;
  project_id: string;
  relationship_type?: string | null;
  notes?: string | null;
  created_at: string;
  project?: Project;
  contact?: PhonebookContact;
}

export interface AIAgent {
  id: string;
  user_id: string;
  name: string;
  role: string;
  description: string | null;
  objectives?: string | null;
  system_prompt: string;
  model_provider: 'ollama' | 'gemini' | 'openai' | 'claude' | string;
  model_name: string | null;
  voice_provider: 'browser' | 'elevenlabs' | 'piper' | 'google' | string | null;
  voice_id: string | null;
  voice_name: string | null;
  voice_language_code: string | null;
  enabled_tools: string[];
  call_mode_default: boolean;
  is_default: boolean;
  is_active: boolean;
  permissions?: string[] | null;
  confirmation_policy?: any | null;
  temperature?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface IntegrationAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id?: string | null;
  display_name: string | null;
  handle?: string | null;
  email?: string | null;
  status: string;
  scopes?: string[] | null;
  connected_at?: string | null;
  last_synced_at?: string | null;
  metadata?: any | null;
  created_at?: string;
  updated_at?: string;
}

export interface SocialProfile {
  id: string;
  user_id: string;
  integration_account_id?: string | null;
  platform_id?: string | null;
  provider: string;
  provider_profile_id?: string | null;
  profile_type?: string | null;
  display_name: string | null;
  handle: string | null;
  profile_url?: string | null;
  avatar_url?: string | null;
  follower_count?: number;
  metrics?: any | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContentAsset {
  id: string;
  user_id: string;
  project_id?: string | null;
  created_by_agent_id?: string | null;
  asset_type: string;
  title: string;
  description?: string | null;
  file_path: string;
  file_url?: string | null;
  prompt?: string | null;
  status: string;
  metadata?: any | null;
  created_at?: string;
  updated_at?: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  social_profile_id?: string | null;
  project_id?: string | null;
  created_by_agent_id?: string | null;
  provider: string;
  external_post_id?: string | null;
  post_type: string;
  title: string | null;
  caption: string | null;
  media_asset_ids?: string[] | null;
  status: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  metrics?: any | null;
  raw_payload?: any | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PublishingJob {
  id: string;
  user_id: string;
  social_post_id: string;
  social_profile_id?: string | null;
  provider: string;
  status: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  result?: any | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgentTask {
  id: string;
  user_id: string;
  requesting_agent_id?: string | null;
  assigned_agent_id?: string | null;
  task_type: string;
  title: string;
  input_json?: any | null;
  result_json?: any | null;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalRequest {
  id: string;
  user_id: string;
  requested_by_agent_id?: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  summary?: string | null;
  risk_level?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  payload?: any | null;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}



