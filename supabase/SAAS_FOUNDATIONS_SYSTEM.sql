-- Neth Dashboard / Command Center AI - SaaS Foundations SQL Schema
-- Integrations Provider metadata, sync metrics, quota usage, AI model pricing, and usage trackers

-- 1. Integration Providers Table
CREATE TABLE IF NOT EXISTS public.integration_providers (
  id TEXT PRIMARY KEY, -- e.g., 'youtube', 'instagram', 'stripe'
  name TEXT NOT NULL,
  purpose TEXT,
  color TEXT,
  icon_key TEXT,
  category TEXT,
  auth_type TEXT DEFAULT 'oauth' NOT NULL,
  oauth_supported BOOLEAN DEFAULT false NOT NULL,
  scopes TEXT[] DEFAULT '{}'::text[] NOT NULL,
  capabilities JSONB DEFAULT '{}'::jsonb NOT NULL,
  requires_app_review BOOLEAN DEFAULT false NOT NULL,
  docs_url TEXT,
  is_publish_enabled BOOLEAN DEFAULT false NOT NULL,
  sort_order INTEGER DEFAULT 100 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrations/Add columns if table existed already without them
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS icon_key TEXT;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'oauth';
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS oauth_supported BOOLEAN DEFAULT false;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS requires_app_review BOOLEAN DEFAULT false;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS docs_url TEXT;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS is_publish_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.integration_providers ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100;

-- Seed providers with capabilities
INSERT INTO public.integration_providers (
  id, name, purpose, color, icon_key, category, auth_type, oauth_supported, scopes, capabilities, is_publish_enabled, sort_order
) VALUES
('youtube', 'YouTube', 'Video & Short Content Publishing', 'text-red-500 bg-red-500/10 border-red-500/20', 'Youtube', 'Social Media', 'oauth', true, ARRAY['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'], '{"read_analytics": true, "publish": true, "create_draft": true, "sync": true}'::jsonb, true, 10),
('instagram', 'Instagram', 'Photo, Reel & Story Sharing', 'text-pink-500 bg-pink-500/10 border-pink-500/20', 'Instagram', 'Social Media', 'oauth', true, ARRAY['instagram_basic', 'instagram_content_publish'], '{"read_analytics": true, "publish": true, "create_draft": true, "webhooks": true}'::jsonb, true, 20),
('tiktok', 'TikTok', 'Short-form Vertical Video', 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', 'Video', 'Social Media', 'oauth', true, ARRAY['video.upload', 'video.publish'], '{"read_analytics": true, "publish": true, "create_draft": true, "sync": true}'::jsonb, true, 30),
('linkedin', 'LinkedIn', 'Professional Updates & Publishing', 'text-blue-500 bg-blue-500/10 border-blue-500/20', 'Linkedin', 'Social Media', 'oauth', true, ARRAY['r_liteprofile', 'w_member_social'], '{"read_analytics": true, "publish": true, "sync": true}'::jsonb, true, 40),
('meta_whatsapp', 'Meta / WhatsApp', 'Messaging, Automation & Ads', 'text-green-500 bg-green-500/10 border-green-500/20', 'MessageSquare', 'Messaging & Communications', 'api_key', false, ARRAY[]::text[], '{"messaging": true, "webhooks": true}'::jsonb, false, 50),
('stripe', 'Stripe', 'Payment Processing & Invoices', 'text-purple-500 bg-purple-500/10 border-purple-500/20', 'CreditCard', 'Finance', 'api_key', false, ARRAY[]::text[], '{"payments": true, "webhooks": true, "read_analytics": true, "sync": true}'::jsonb, false, 60),
('amazon', 'Amazon', 'Seller Center & Store Catalog', 'text-amber-500 bg-amber-500/10 border-amber-500/20', 'ShoppingBag', 'E-Commerce', 'api_key', false, ARRAY[]::text[], '{"sync": true, "read_analytics": true}'::jsonb, false, 70),
('bank', 'Bank / Finance Portal', 'Account Sync & Treasury', 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', 'DollarSign', 'Finance', 'plaid_token', false, ARRAY[]::text[], '{"sync": true}'::jsonb, false, 80),
('website', 'Website / Custom', 'Direct Site Integration & Webhooks', 'text-sky-400 bg-sky-400/10 border-sky-400/20', 'Globe', 'Custom Integration', 'api_key', false, ARRAY[]::text[], '{"webhooks": true, "sync": true}'::jsonb, false, 90)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  purpose = EXCLUDED.purpose,
  color = EXCLUDED.color,
  icon_key = EXCLUDED.icon_key,
  category = EXCLUDED.category,
  auth_type = EXCLUDED.auth_type,
  oauth_supported = EXCLUDED.oauth_supported,
  scopes = EXCLUDED.scopes,
  capabilities = EXCLUDED.capabilities,
  is_publish_enabled = EXCLUDED.is_publish_enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc'::text, now());

-- 2. Integration OAuth States Table
CREATE TABLE IF NOT EXISTS public.integration_oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  state_token TEXT UNIQUE NOT NULL,
  redirect_uri TEXT,
  scopes TEXT[],
  is_valid BOOLEAN DEFAULT true NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Integration Sync Runs Table
CREATE TABLE IF NOT EXISTS public.integration_sync_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_account_id UUID REFERENCES public.integration_accounts(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'syncing', 'completed', 'failed'
  sync_type TEXT DEFAULT 'delta', -- 'delta', 'full'
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Integration Webhook Events Table
CREATE TABLE IF NOT EXISTS public.integration_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  external_event_id TEXT,
  event_type TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed', 'ignored'
  error TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration to update Webhook columns
ALTER TABLE public.integration_webhook_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.integration_webhook_events ADD COLUMN IF NOT EXISTS integration_account_id UUID REFERENCES public.integration_accounts(id) ON DELETE SET NULL;

-- Create constraint unique for provider and external_event_id safely
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_provider_external ON public.integration_webhook_events (provider, external_event_id) WHERE external_event_id IS NOT NULL;

-- 5. Integration Quota Usage Table
CREATE TABLE IF NOT EXISTS public.integration_quota_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_account_id UUID REFERENCES public.integration_accounts(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  quota_metric TEXT NOT NULL, -- 'api_calls', 'publishing_posts', 'sync_megabytes'
  quota_limit INTEGER NOT NULL,
  quota_used INTEGER DEFAULT 0 NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT integration_quota_unique UNIQUE (user_id, integration_account_id, quota_metric, window_start)
);

-- 6. AI Model Prices Table
CREATE TABLE IF NOT EXISTS public.ai_model_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL, -- 'gemini', 'openai', 'anthropic', 'google-tts', 'elevenlabs', 'ollama'
  model_name TEXT NOT NULL UNIQUE, -- e.g. 'gemini-2.5-flash-lite', 'gpt-4o', etc.
  input_token_price_usd NUMERIC(15, 10) DEFAULT 0 NOT NULL, -- price per token
  output_token_price_usd NUMERIC(15, 10) DEFAULT 0 NOT NULL, -- price per token
  cached_input_token_price_usd NUMERIC(15, 10) DEFAULT 0 NOT NULL, -- price per token
  flat_price_usd NUMERIC(15, 6) DEFAULT 0 NOT NULL, -- flat price per operation (optional, e.g. Dall-E)
  char_price_usd NUMERIC(15, 10) DEFAULT 0 NOT NULL, -- TTS character price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed standard prices. Corrected per requirements:
-- gemini-2.5-flash-lite: input 0.00000010, output 0.00000040, cached input 0.000000025
-- google-tts / Chirp 3 HD: char_price_usd 0.00003000
-- gpt-4.1-mini: input 0.00000040, output 0.00000160, cached input 0.00000010
INSERT INTO public.ai_model_prices (provider, model_name, input_token_price_usd, output_token_price_usd, cached_input_token_price_usd, char_price_usd) VALUES
('gemini', 'gemini-2.5-flash-lite', 0.00000010, 0.00000040, 0.000000025, 0),
('gemini', 'gemini-2.5-flash', 0.000000075, 0.00000030, 0.0000000375, 0),
('gemini', 'gemini-1.5-flash', 0.000000075, 0.00000030, 0.0000000375, 0),
('gemini', 'gemini-1.5-pro', 0.00000125, 0.00000500, 0.000000625, 0),
('openai', 'gpt-4o-mini', 0.000000150, 0.00000060, 0.000000075, 0),
('openai', 'gpt-4.1-mini', 0.00000040, 0.00000160, 0.00000010, 0),
('openai', 'gpt-4o', 0.00000250, 0.00001000, 0.00000125, 0),
('anthropic', 'claude-haiku-4-5', 0.00000025, 0.00000125, 0, 0),
('anthropic', 'claude-3-5-sonnet', 0.00000300, 0.00001500, 0, 0),
('google-tts', 'google-tts', 0, 0, 0, 0.00003000), -- google chirp high fidelity voice per char (Chirp 3 HD)
('elevenlabs', 'elevenlabs', 0, 0, 0, 0.00003000), -- elevenlabs standard / flash speed estimated cost per char
('ollama', 'ollama', 0, 0, 0, 0)
ON CONFLICT (model_name) DO UPDATE SET
  input_token_price_usd = EXCLUDED.input_token_price_usd,
  output_token_price_usd = EXCLUDED.output_token_price_usd,
  cached_input_token_price_usd = EXCLUDED.cached_input_token_price_usd,
  char_price_usd = EXCLUDED.char_price_usd,
  updated_at = timezone('utc'::text, now());

-- 7. AI Usage Events Table
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  operation_type TEXT DEFAULT 'chat' NOT NULL, -- 'chat', 'tts', 'image', 'voice'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_input_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  char_count INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(15, 8) DEFAULT 0 NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. AI Usage Limits Table
CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  daily_budget_usd NUMERIC(15, 4) DEFAULT 10.0000 NOT NULL,
  monthly_budget_usd NUMERIC(15, 4) DEFAULT 100.0000 NOT NULL,
  per_agent_monthly_budget_usd NUMERIC(15, 4) DEFAULT 10.0000 NOT NULL,
  stop_on_limit BOOLEAN DEFAULT true NOT NULL,
  warn_threshold_percent NUMERIC(5, 2) DEFAULT 80.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================
-- ROW LEVEL SECURITY RULES
-- =====================================
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

-- 2. Extend ai_agent_runs Table dynamically to allow granular token trackers
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS cached_input_tokens INTEGER DEFAULT 0;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(15, 8) DEFAULT 0;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS latency_ms INTEGER DEFAULT 0;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'chat';

-- Providers: Select by all users
DROP POLICY IF EXISTS "Anyone can read integration providers" ON public.integration_providers;
CREATE POLICY "Anyone can read integration providers" ON public.integration_providers
  FOR SELECT USING (true);

-- OAuth States: Owner read/write
DROP POLICY IF EXISTS "Users can manage oauth states" ON public.integration_oauth_states;
CREATE POLICY "Users can manage oauth states" ON public.integration_oauth_states
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sync Runs: Owner read/write
DROP POLICY IF EXISTS "Users can manage sync runs" ON public.integration_sync_runs;
CREATE POLICY "Users can manage sync runs" ON public.integration_sync_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Webhook: Locked / Admin
DROP POLICY IF EXISTS "Webhooks internal restricted policy" ON public.integration_webhook_events;
CREATE POLICY "Webhooks internal restricted policy" ON public.integration_webhook_events
  FOR ALL USING (false);

-- Quota: Owner view/write
DROP POLICY IF EXISTS "Users can manage quota" ON public.integration_quota_usage;
CREATE POLICY "Users can manage quota" ON public.integration_quota_usage
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Model Prices: Public read
DROP POLICY IF EXISTS "Anyone can select model prices" ON public.ai_model_prices;
CREATE POLICY "Anyone can select model prices" ON public.ai_model_prices
  FOR SELECT USING (true);

-- AI Usage Events: Only Owner SELECT, NO users insert/update/delete (Service role does insertion)
DROP POLICY IF EXISTS "Users can select usage events" ON public.ai_usage_events;
CREATE POLICY "Users can select usage events" ON public.ai_usage_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert usage events" ON public.ai_usage_events;
-- Intentionally do NOT define INSERT policy so frontend/RLS restricts inserts; service role must bypass RLS.

-- Limits: Owner manage
DROP POLICY IF EXISTS "Users can manage usage limits" ON public.ai_usage_limits;
CREATE POLICY "Users can manage usage limits" ON public.ai_usage_limits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- =====================================
-- OPTIMIZED INDEXES FOR HIGH-THROUGHPUT TRACKING
-- =====================================
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user ON public.ai_usage_events (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_agent ON public.ai_usage_events (agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created ON public.ai_usage_events (created_at);
CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_user ON public.integration_sync_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_limits_user ON public.ai_usage_limits (user_id);
