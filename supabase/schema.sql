/**
 * Command Center AI - Official Supabase Schema
 * Source of truth for Neth Dashboard
 */

-- ==========================================
-- 1. TABLE DEFINITIONS (Topological Order)
-- ==========================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Businesses
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, inactive, archived
  tax_id TEXT,
  incorporation_date DATE,
  legal_address TEXT,
  website_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Platforms
CREATE TABLE IF NOT EXISTS public.platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'active', -- active, warning, inactive, archived
  login_notes TEXT,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'business',
  description TEXT,
  status TEXT DEFAULT 'planning', -- planning, in_progress, completed, on_hold, cancelled
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  deadline TIMESTAMP WITH TIME ZONE,
  budget DECIMAL(12, 2),
  progress INTEGER DEFAULT 0,
  ai_summary TEXT,
  next_action TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'backlog', -- backlog, today, in_progress, waiting, done, cancelled
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  work_date TIMESTAMP WITH TIME ZONE,
  recurring_type TEXT DEFAULT 'none',
  recurring_config JSONB,
  email_link TEXT,
  ai_priority_score INTEGER,
  ai_suggested_next_step TEXT,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email Accounts
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL, -- gmail, outlook, custom
  provider_account_id TEXT,
  display_color TEXT DEFAULT '#3b82f6',
  display_icon TEXT,
  display_name TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email Account Tokens (Restricted)
CREATE TABLE IF NOT EXISTS public.email_account_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email Folders
CREATE TABLE IF NOT EXISTS public.email_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_label_id TEXT,
  color TEXT,
  folder_type TEXT DEFAULT 'custom', -- inbox, sent, draft, trash, custom
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email Routing Rules
CREATE TABLE IF NOT EXISTS public.email_routing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.email_folders(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  match_type TEXT DEFAULT 'contains', -- contains, equals, starts_with, regex
  field TEXT DEFAULT 'sender', -- sender, subject, snippet, body_text, tags
  pattern TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Emails
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'new', -- new, needs_action, waiting, handled, archived
  ai_summary TEXT,
  ai_suggested_reply TEXT,
  ai_importance_score INTEGER,
  ai_importance_reason TEXT,
  ai_suggested_task_title TEXT,
  ai_suggested_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  linked_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  linked_platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  provider_thread_id TEXT,
  provider_labels TEXT[],
  tags TEXT[] NOT NULL DEFAULT '{}',
  ai_suggested_tags TEXT[] NOT NULL DEFAULT '{}',
  folder_id UUID REFERENCES public.email_folders(id) ON DELETE SET NULL,
  raw_payload JSONB,
  ai_suggested_folder_name TEXT,
  ai_suggested_folder_confidence INTEGER,
  ai_suggested_folder_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Project Items
CREATE TABLE IF NOT EXISTS public.project_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  item_type TEXT, -- e.g., 'product', 'feature', 'document', 'milestone'
  status TEXT DEFAULT 'active', -- e.g., 'active', 'draft', 'archived', 'completed'
  priority TEXT DEFAULT 'medium', -- e.g., 'low', 'medium', 'high', 'urgent'
  description TEXT,
  sku TEXT,
  url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Daily Plans
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  morning_plan TEXT,
  top_priorities TEXT[],
  time_blocks JSONB,
  end_day_review TEXT,
  notes TEXT,
  ai_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date)
);

-- AI Settings
CREATE TABLE IF NOT EXISTS public.ai_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  ollama_endpoint TEXT DEFAULT 'http://localhost:11434/api/generate',
  model_name TEXT DEFAULT 'gemma4:12b',
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  allow_sensitive_context BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email Account Businesses (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.email_account_businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(email_account_id, business_id)
);

-- Email Project Links (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.email_project_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_id UUID REFERENCES public.emails(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(email_id, project_id)
);

-- Phonebook Contacts
CREATE TABLE IF NOT EXISTS public.phonebook_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact_type TEXT DEFAULT 'other', -- client, supplier, partner, contractor, etc.
  company_name TEXT,
  email TEXT,
  phone TEXT,
  website_url TEXT,
  tax_id TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Financial Accounts
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE, -- For Sub-Accounts and Cards
  name TEXT NOT NULL,
  account_type TEXT DEFAULT 'bank', -- bank, credit_card, debit_card, savings, checking, etc.
  institution_name TEXT,
  currency TEXT DEFAULT 'USD',
  account_number_last4 TEXT,
  routing_number TEXT,
  account_number TEXT,
  swift_bic TEXT,
  bank_code TEXT,
  opening_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Many-to-many between Financial Accounts and Businesses
CREATE TABLE IF NOT EXISTS public.financial_account_businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(financial_account_id, business_id)
);

-- Expenses (Cashflow Entries)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL, -- main project
  project_item_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL,
  financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  counterparty_contact_id UUID REFERENCES public.phonebook_contacts(id) ON DELETE SET NULL,
  direction TEXT DEFAULT 'out' CHECK (direction IN ('in', 'out')),
  title TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_type TEXT CHECK (payment_type IN ('cash', 'bank_transfer', 'debit_card', 'credit_card', 'paypal', 'stripe', 'wise', 'zelle', 'check', 'crypto', 'other')),
  category TEXT,
  subcategory TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('planned', 'pending', 'paid', 'received', 'cancelled')),
  expense_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  settled_at TIMESTAMP WITH TIME ZONE,
  reference_number TEXT,
  receipt_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  recurring_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expense Project Links (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.expense_project_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(expense_id, project_id)
);

-- OAuth States (for secure flow)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state_token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_ids UUID[],
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '10 minutes') NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expense Receipts Table
CREATE TABLE IF NOT EXISTS public.expense_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contact-Project Links Table
CREATE TABLE IF NOT EXISTS public.contact_project_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.phonebook_contacts(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  relationship_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(contact_id, project_id)
);

-- Project Files Table (NEW)
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  project_item_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS) ENABLEMENT
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_account_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phonebook_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_account_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Profiles
DROP POLICY IF EXISTS "Users can only access their own profiles" ON public.profiles;
CREATE POLICY "Users can only access their own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Businesses
DROP POLICY IF EXISTS "Users can only access their own businesses" ON public.businesses;
CREATE POLICY "Users can only access their own businesses" ON public.businesses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Platforms
DROP POLICY IF EXISTS "Users can only access their own platforms" ON public.platforms;
CREATE POLICY "Users can only access their own platforms" ON public.platforms FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Projects
DROP POLICY IF EXISTS "Users can only access their own projects" ON public.projects;
CREATE POLICY "Users can only access their own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks
DROP POLICY IF EXISTS "Users can only access their own tasks" ON public.tasks;
CREATE POLICY "Users can only access their own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email Accounts
DROP POLICY IF EXISTS "Users can only access their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can only access their own email accounts" ON public.email_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email Account Tokens (Restricted)
DROP POLICY IF EXISTS "Service role only access to tokens" ON public.email_account_tokens;
CREATE POLICY "Service role only access to tokens" ON public.email_account_tokens FOR ALL USING (false);

-- Email Folders
DROP POLICY IF EXISTS "Users can only access their own email folders" ON public.email_folders;
CREATE POLICY "Users can only access their own email folders" ON public.email_folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email Routing Rules
DROP POLICY IF EXISTS "Users can only access their own email routing rules" ON public.email_routing_rules;
CREATE POLICY "Users can only access their own email routing rules" ON public.email_routing_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Emails
DROP POLICY IF EXISTS "Users can only access their own emails" ON public.emails;
CREATE POLICY "Users can only access their own emails" ON public.emails FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Project Items
DROP POLICY IF EXISTS "Users can manage their own project items" ON public.project_items;
CREATE POLICY "Users can manage their own project items" ON public.project_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily Plans
DROP POLICY IF EXISTS "Users can only access their own daily plans" ON public.daily_plans;
CREATE POLICY "Users can only access their own daily plans" ON public.daily_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI Settings
DROP POLICY IF EXISTS "Users can only access their own AI settings" ON public.ai_settings;
CREATE POLICY "Users can only access their own AI settings" ON public.ai_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Activity Logs
DROP POLICY IF EXISTS "Users can only access their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can only access their own activity logs" ON public.activity_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email Account Businesses
DROP POLICY IF EXISTS "Users can manage their own email bizes link" ON public.email_account_businesses;
CREATE POLICY "Users can manage their own email bizes link" ON public.email_account_businesses 
  FOR ALL USING (auth.uid() = user_id) 
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM public.email_accounts WHERE id = email_account_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.businesses WHERE id = business_id AND user_id = auth.uid())
  );

-- Email Project Links
DROP POLICY IF EXISTS "Users can manage their own email project links" ON public.email_project_links;
CREATE POLICY "Users can manage their own email project links" ON public.email_project_links 
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.emails WHERE id = email_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Phonebook Contacts
DROP POLICY IF EXISTS "Users can only access their own contacts" ON public.phonebook_contacts;
CREATE POLICY "Users can only access their own contacts" ON public.phonebook_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Financial Accounts
DROP POLICY IF EXISTS "Users can only access their own financial accounts" ON public.financial_accounts;
CREATE POLICY "Users can only access their own financial accounts" ON public.financial_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Financial Account Businesses
DROP POLICY IF EXISTS "Users can manage their own account-business links" ON public.financial_account_businesses;
CREATE POLICY "Users can manage their own account-business links" ON public.financial_account_businesses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expenses
DROP POLICY IF EXISTS "Users can only access their own expenses" ON public.expenses;
CREATE POLICY "Users can only access their own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expense Project Links
DROP POLICY IF EXISTS "Users can manage their own expense project links" ON public.expense_project_links;
CREATE POLICY "Users can manage their own expense project links" ON public.expense_project_links 
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.expenses WHERE id = expense_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- OAuth States (Restricted)
DROP POLICY IF EXISTS "No client access to OAuth states" ON public.oauth_states;
CREATE POLICY "No client access to OAuth states" ON public.oauth_states FOR ALL USING (false);

-- Expense Receipts Table
DROP POLICY IF EXISTS "Users can manage their own expense receipts" ON public.expense_receipts;
CREATE POLICY "Users can manage their own expense receipts" ON public.expense_receipts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Contact-Project Links Table
DROP POLICY IF EXISTS "Users can manage their own contact-project links" ON public.contact_project_links;
CREATE POLICY "Users can manage their own contact-project links" ON public.contact_project_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Project Files Table Policy (NEW)
DROP POLICY IF EXISTS "Users can manage their own project files" ON public.project_files;
CREATE POLICY "Users can manage their own project files" ON public.project_files 
  FOR ALL USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 4. INDEXES
-- ==========================================
-- GIN Indexes for Email Tags
CREATE INDEX IF NOT EXISTS emails_tags_idx ON public.emails USING GIN(tags);
CREATE INDEX IF NOT EXISTS emails_ai_suggested_tags_idx ON public.emails USING GIN(ai_suggested_tags);

-- Unique constraint for sync
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emails_account_provider_message_unique') THEN
        ALTER TABLE public.emails ADD CONSTRAINT emails_account_provider_message_unique UNIQUE(account_id, provider_message_id);
    END IF;
END $$;

-- Unique constraint for email accounts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_user_provider_account_unique') THEN
        ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_user_provider_account_unique UNIQUE(user_id, provider_account_id);
    END IF;
END $$;

-- ==========================================
-- 5. TRIGGER FUNCTIONS & TRIGGERS
-- ==========================================

-- Trigger to update financial_accounts balance based on expenses
CREATE OR REPLACE FUNCTION public.update_financial_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_old_affecting BOOLEAN;
  v_new_affecting BOOLEAN;
BEGIN
  v_old_affecting := (TG_OP IN ('UPDATE', 'DELETE')) AND (OLD.financial_account_id IS NOT NULL) AND (OLD.status IN ('paid', 'received'));
  v_new_affecting := (TG_OP IN ('INSERT', 'UPDATE')) AND (NEW.financial_account_id IS NOT NULL) AND (NEW.status IN ('paid', 'received'));

  IF TG_OP = 'DELETE' THEN
    IF v_old_affecting THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance + CASE WHEN OLD.direction = 'out' THEN OLD.amount ELSE -OLD.amount END
      WHERE id = OLD.financial_account_id;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF v_new_affecting THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance + CASE WHEN NEW.direction = 'out' THEN -NEW.amount ELSE NEW.amount END
      WHERE id = NEW.financial_account_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_old_affecting THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance + CASE WHEN OLD.direction = 'out' THEN OLD.amount ELSE -OLD.amount END
      WHERE id = OLD.financial_account_id;
    END IF;

    IF v_new_affecting THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance + CASE WHEN NEW.direction = 'out' THEN -NEW.amount ELSE NEW.amount END
      WHERE id = NEW.financial_account_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_financial_account_balance ON public.expenses;
CREATE TRIGGER trg_update_financial_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_financial_account_balance();

-- ==========================================
-- 6. SUPABASE STORAGE BUCKETS & POLICIES
-- ==========================================

-- Create project-files and expense-receipts buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('project-files', 'project-files', false),
  ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Objects Policies for project-files bucket
DROP POLICY IF EXISTS "Allow authenticated users access to their own project-files folder" ON storage.objects;
CREATE POLICY "Allow authenticated users access to their own project-files folder"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'project-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'project-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Objects Policies for expense-receipts bucket
DROP POLICY IF EXISTS "Allow authenticated users access to their own expense-receipts folder" ON storage.objects;
CREATE POLICY "Allow authenticated users access to their own expense-receipts folder"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'expense-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- 7. AI AGENTS & VOICE OPTIONS (Dynamic System)
-- ==========================================

-- AI Voice Options
CREATE TABLE IF NOT EXISTS public.ai_voice_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('browser', 'google', 'elevenlabs', 'piper')),
  voice_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en-US',
  gender TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (provider, voice_name)
);

-- Enable RLS on ai_voice_options
ALTER TABLE public.ai_voice_options ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users for voice options
DROP POLICY IF EXISTS "Allow authenticated read for voice options" ON public.ai_voice_options;
CREATE POLICY "Allow authenticated read for voice options"
ON public.ai_voice_options
FOR SELECT
TO authenticated
USING (is_active = true);

-- AI Agents Table
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  objectives TEXT,
  system_prompt TEXT NOT NULL,
  model_provider TEXT NOT NULL CHECK (model_provider IN ('ollama', 'gemini', 'openai', 'claude')),
  model_name TEXT,
  voice_provider TEXT NOT NULL CHECK (voice_provider IN ('browser', 'google', 'elevenlabs', 'piper')),
  voice_id TEXT,
  voice_name TEXT,
  voice_language_code TEXT,
  enabled_tools TEXT[] DEFAULT '{}'::TEXT[],
  call_mode_default BOOLEAN DEFAULT false,
  permissions TEXT[] DEFAULT '{}'::TEXT[],
  confirmation_policy JSONB DEFAULT '{}'::JSONB,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_agents
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agents
DROP POLICY IF EXISTS "Users can manage their own AI agents" ON public.ai_agents;
CREATE POLICY "Users can manage their own AI agents"
ON public.ai_agents
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for AI Agent system
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON public.ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_is_default ON public.ai_agents(is_default);
CREATE INDEX IF NOT EXISTS idx_ai_voice_options_provider ON public.ai_voice_options(provider);

-- Trigger for updated_at in ai_agents
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ai_agents_updated_at ON public.ai_agents;
CREATE TRIGGER trg_update_ai_agents_updated_at
BEFORE UPDATE ON public.ai_agents
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Seed Google TTS and fallback voice options
INSERT INTO public.ai_voice_options (provider, voice_name, display_name, language_code, gender, description, sort_order)
VALUES
  ('google', 'en-US-Chirp3-HD-Aoede', 'Aoede (HD-English)', 'en-US', 'female', 'High Quality Chirp3 HD Female Voice', 1),
  ('google', 'en-US-Chirp3-HD-Charon', 'Charon (HD-English)', 'en-US', 'male', 'High Quality Chirp3 HD Male Voice', 2),
  ('google', 'en-US-Journey-F', 'Journey Female (English)', 'en-US', 'female', 'Natural Journey Female Voice', 3),
  ('google', 'en-US-Neural2-F', 'Neural2 Female (English)', 'en-US', 'female', 'Neural2 High Quality Female Voice', 4),
  ('google', 'en-US-Wavenet-D', 'Wavenet Male (English)', 'en-US', 'male', 'Classic Wavenet Male Voice', 5),
  ('elevenlabs', '21m00Tcm4TlvDq8iKC9e', 'Rachel (Female)', 'en-US', 'female', 'Rachel - Narrator / Warm voice', 10),
  ('elevenlabs', 'AZnzlk1XvdvUeBnXmlld', 'Domi (Female)', 'en-US', 'female', 'Domi - Energetic / Prompt voice', 11),
  ('elevenlabs', 'EXAVITQu4vr4xnSDxMaL', 'Bella (Female)', 'en-US', 'female', 'Bella - Soft / Friendly voice', 12),
  ('elevenlabs', 'ErXwobaYiN019PkySvjV', 'Antoni (Male)', 'en-US', 'male', 'Antoni - Professional Voice', 13),
  ('browser', 'default', 'System Default', 'en-US', 'unspecified', 'Web Speech Synthesis Default Voice', 20),
  ('piper', 'en_US-amy-medium', 'Amy (Medium)', 'en-US', 'female', 'Local Piper Amy Medium Voice', 30),
  ('piper', 'en_US-lessac-high', 'Lessac (High)', 'en-US', 'female', 'Local Piper Lessac High Voice', 31)
ON CONFLICT (provider, voice_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider = EXCLUDED.provider,
  language_code = EXCLUDED.language_code,
  gender = EXCLUDED.gender,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;


-- ==========================================
-- 8. MEMORIES & ACTIONS (Advanced Agent System)
-- ==========================================

-- AI Agent Memories
CREATE TABLE IF NOT EXISTS public.ai_agent_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- e.g., 'preference', 'fact', 'contact_note', 'project_note'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  source TEXT, -- e.g., 'chat', 'feedback', 'inbox'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_agent_memories
ALTER TABLE public.ai_agent_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own memories" ON public.ai_agent_memories;
CREATE POLICY "Users can manage their own memories"
ON public.ai_agent_memories
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Pending Actions
CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- create_project, create_task, etc.
  entity_type TEXT NOT NULL, -- project, task, expense, contact, email, calendar_event, project_note etc.
  payload JSONB NOT NULL,
  summary TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'skipped', 'executed', 'failed', 'expired')),
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on ai_pending_actions
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own pending actions" ON public.ai_pending_actions;
CREATE POLICY "Users can manage their own pending actions"
ON public.ai_pending_actions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Agent Runs (Logging LLM conversation round-trips)
CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  provider TEXT,
  model TEXT,
  prompt TEXT,
  response TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'blocked')),
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_agent_runs
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own agent runs" ON public.ai_agent_runs;
CREATE POLICY "Users can manage their own agent runs"
ON public.ai_agent_runs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Agent Tool Calls (Logging Tool Executions)
CREATE TABLE IF NOT EXISTS public.ai_agent_tool_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE CASCADE,
  pending_action_id UUID REFERENCES public.ai_pending_actions(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'blocked')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on ai_agent_tool_calls
ALTER TABLE public.ai_agent_tool_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own agent tool calls" ON public.ai_agent_tool_calls;
CREATE POLICY "Users can manage their own agent tool calls"
ON public.ai_agent_tool_calls
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for memories, actions, runs and tools
CREATE INDEX IF NOT EXISTS idx_ai_agent_memories_user ON public.ai_agent_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user ON public.ai_pending_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status ON public.ai_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_user ON public.ai_agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tool_calls_user ON public.ai_agent_tool_calls(user_id);


-- ==========================================
-- 9. HYBRID CONTEXT ARCHITECTURE
-- ==========================================

-- AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  title TEXT,
  rolling_summary TEXT,
  status TEXT DEFAULT 'active',
  summary_updated_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_conversations
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can manage their own conversations"
ON public.ai_conversations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_messages
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own messages" ON public.ai_messages;
CREATE POLICY "Users can manage their own messages"
ON public.ai_messages
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI User Profiles
CREATE TABLE IF NOT EXISTS public.ai_user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile_summary TEXT,
  preferences_summary TEXT,
  personal_context_summary TEXT,
  business_context_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_user_profiles
ALTER TABLE public.ai_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.ai_user_profiles;
CREATE POLICY "Users can manage their own profiles"
ON public.ai_user_profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Context Packages
CREATE TABLE IF NOT EXISTS public.ai_context_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  selected_memory_ids JSONB DEFAULT '[]'::jsonb,
  database_context_keys JSONB DEFAULT '[]'::jsonb,
  estimated_input_chars INTEGER DEFAULT 0,
  package JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_context_packages
ALTER TABLE public.ai_context_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own context packages" ON public.ai_context_packages;
CREATE POLICY "Users can manage their own context packages"
ON public.ai_context_packages
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Extra indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent ON public.ai_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON public.ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_profiles_user ON public.ai_user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_packages_user ON public.ai_context_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_packages_conversation ON public.ai_context_packages(conversation_id);

-- AI Automations
CREATE TABLE IF NOT EXISTS public.ai_automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  automation_type TEXT NOT NULL, -- e.g., 'daily_briefing', 'end_day_review', 'email_triage', 'task_review', 'project_review', 'finance_review', 'calendar_review', 'custom'
  description TEXT,
  enabled BOOLEAN DEFAULT true NOT NULL,
  schedule_type TEXT NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly', 'manual'
  schedule_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_automations
ALTER TABLE public.ai_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own automations" ON public.ai_automations;
CREATE POLICY "Users can manage their own automations"
ON public.ai_automations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Automation Runs
CREATE TABLE IF NOT EXISTS public.ai_automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  automation_id UUID REFERENCES public.ai_automations(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  input_context JSONB DEFAULT '{}'::jsonb,
  output_summary TEXT,
  created_pending_action_ids UUID[],
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on ai_automation_runs
ALTER TABLE public.ai_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own automation runs" ON public.ai_automation_runs;
CREATE POLICY "Users can manage their own automation runs"
ON public.ai_automation_runs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- AI Notifications
CREATE TABLE IF NOT EXISTS public.ai_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES public.ai_automations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'info' CHECK (notification_type IN ('info', 'warning', 'urgent', 'success')),
  is_read BOOLEAN DEFAULT false NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on ai_notifications
ALTER TABLE public.ai_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.ai_notifications;
CREATE POLICY "Users can manage their own notifications"
ON public.ai_notifications
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_automations_user ON public.ai_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_automation_runs_user ON public.ai_automation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_user ON public.ai_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_read ON public.ai_notifications(is_read);


-- AI Agent Activity Events
CREATE TABLE IF NOT EXISTS public.agent_activity_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  pending_action_id UUID REFERENCES public.ai_pending_actions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  title TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on agent_activity_events
ALTER TABLE public.agent_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own agent activity events" ON public.agent_activity_events;
CREATE POLICY "Users can manage their own agent activity events"
ON public.agent_activity_events
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for agent_activity_events
CREATE INDEX IF NOT EXISTS idx_agent_activity_events_user ON public.agent_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_events_convo ON public.agent_activity_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_events_action ON public.agent_activity_events(pending_action_id);





