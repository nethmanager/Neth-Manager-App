-- Command Center AI - Phase 1 Integrations SQL Schema
-- Official extension of the core schema for Neth Dashboard Integration System

-- 1. Extend public.platforms Table
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS platform_type TEXT;
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'disconnected';
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE public.platforms ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Integration Accounts Table
CREATE TABLE IF NOT EXISTS public.integration_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'youtube', 'instagram', 'tiktok', 'linkedin'
  provider_account_id TEXT,
  display_name TEXT,
  handle TEXT,
  email TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  scopes TEXT[],
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT integration_accounts_user_provider_unique UNIQUE (user_id, provider, provider_account_id)
);

-- 3. Integration Credentials Table (Service level access only)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_account_id UUID REFERENCES public.integration_accounts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  raw_credentials JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Social Profiles Table
CREATE TABLE IF NOT EXISTS public.social_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_account_id UUID REFERENCES public.integration_accounts(id) ON DELETE SET NULL,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- e.g. 'instagram', 'youtube'
  provider_profile_id TEXT,
  profile_type TEXT, -- 'personal', 'business'
  display_name TEXT,
  handle TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  follower_count INTEGER DEFAULT 0 NOT NULL,
  metrics JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Content Assets Table
CREATE TABLE IF NOT EXISTS public.content_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL, -- e.g., 'image', 'video', 'document'
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT,
  prompt TEXT,
  status TEXT DEFAULT 'draft' NOT NULL, -- 'draft', 'pending', 'approved', 'rejected'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Social Posts Table
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  social_profile_id UUID REFERENCES public.social_profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_post_id TEXT,
  post_type TEXT DEFAULT 'post' NOT NULL, -- 'post', 'reel', 'story', 'shorts'
  title TEXT,
  caption TEXT,
  media_asset_ids UUID[],
  status TEXT DEFAULT 'draft' NOT NULL, -- 'draft', 'scheduled', 'publishing', 'published', 'failed'
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  metrics JSONB DEFAULT '{}'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Publishing Jobs Table
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  social_post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  social_profile_id UUID REFERENCES public.social_profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  result JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Agent Tasks Table
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requesting_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL, -- e.g., 'generation', 'post_creation', 'approval_tracking'
  title TEXT NOT NULL,
  input_json JSONB DEFAULT '{}'::jsonb,
  result_json JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  due_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Approval Requests Table
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_by_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'content_asset', 'social_post', 'agent_task'
  entity_id UUID, -- Optional ID referencing the entities above
  action_type TEXT NOT NULL, -- e.g. 'publish', 'approve_creative'
  summary TEXT,
  risk_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'approved', 'rejected'
  payload JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES FOR USER-LEVEL SECURITY
-- ==========================================

-- Integration Accounts
DROP POLICY IF EXISTS "Users can manage their own integration accounts" ON public.integration_accounts;
CREATE POLICY "Users can manage their own integration accounts" ON public.integration_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Integration Credentials (restricted, service role access only)
DROP POLICY IF EXISTS "Service role only access to integration credentials" ON public.integration_credentials;
CREATE POLICY "Service role only access to integration credentials" ON public.integration_credentials
  FOR ALL USING (false);

-- Social Profiles
DROP POLICY IF EXISTS "Users can manage their own social profiles" ON public.social_profiles;
CREATE POLICY "Users can manage their own social profiles" ON public.social_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Content Assets
DROP POLICY IF EXISTS "Users can manage their own content assets" ON public.content_assets;
CREATE POLICY "Users can manage their own content assets" ON public.content_assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Social Posts
DROP POLICY IF EXISTS "Users can manage their own social posts" ON public.social_posts;
CREATE POLICY "Users can manage their own social posts" ON public.social_posts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Publishing Jobs
DROP POLICY IF EXISTS "Users can manage their own publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can manage their own publishing jobs" ON public.publishing_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Agent Tasks
DROP POLICY IF EXISTS "Users can manage their own agent tasks" ON public.agent_tasks;
CREATE POLICY "Users can manage their own agent tasks" ON public.agent_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Approval Requests
DROP POLICY IF EXISTS "Users can manage their own approval requests" ON public.approval_requests;
CREATE POLICY "Users can manage their own approval requests" ON public.approval_requests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- INDEXES FOR SEAMLESS PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_integration_accounts_user_id ON public.integration_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_social_profiles_user_id ON public.social_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_user_id ON public.content_assets (user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON public.social_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_user_id ON public.publishing_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id ON public.agent_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_user_id ON public.approval_requests (user_id);
