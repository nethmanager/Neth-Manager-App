-- Add display_color and display_name columns to oauth_states if missing
ALTER TABLE public.oauth_states ADD COLUMN IF NOT EXISTS display_color TEXT;
ALTER TABLE public.oauth_states ADD COLUMN IF NOT EXISTS display_name TEXT;

-- calendar_accounts
CREATE TABLE IF NOT EXISTS public.calendar_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'google'
  provider_account_id TEXT NOT NULL, -- e.g., google calendar email or sub profile id
  email_address TEXT NOT NULL,
  display_name TEXT,
  display_color TEXT DEFAULT '#3b82f6',
  status TEXT DEFAULT 'active' NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT calendar_accounts_user_provider_account_unique UNIQUE(user_id, provider, provider_account_id)
);

-- calendar_account_tokens
CREATE TABLE IF NOT EXISTS public.calendar_account_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_account_id UUID REFERENCES public.calendar_accounts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- calendar_events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  calendar_account_id UUID REFERENCES public.calendar_accounts(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  provider_calendar_id TEXT NOT NULL, -- e.g. calendar id (often 'primary')
  provider_event_id TEXT NOT NULL, -- Google's event ID
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false NOT NULL,
  status TEXT DEFAULT 'confirmed' NOT NULL,
  html_link TEXT,
  attendees JSONB,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT calendar_events_account_provider_event_unique UNIQUE(calendar_account_id, provider_calendar_id, provider_event_id)
);

-- RLS Enablement
ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies for calendar_accounts
DROP POLICY IF EXISTS "Users can manage their own calendar accounts" ON public.calendar_accounts;
CREATE POLICY "Users can manage their own calendar accounts" ON public.calendar_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for calendar_account_tokens: service role only
DROP POLICY IF EXISTS "Service role only access to calendar tokens" ON public.calendar_account_tokens;
CREATE POLICY "Service role only access to calendar tokens" ON public.calendar_account_tokens
  FOR ALL USING (false);

-- Policies for calendar_events
DROP POLICY IF EXISTS "Users can manage their own calendar events" ON public.calendar_events;
CREATE POLICY "Users can manage their own calendar events" ON public.calendar_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS calendar_events_user_start_idx ON public.calendar_events(user_id, start_at);
CREATE INDEX IF NOT EXISTS calendar_accounts_user_idx ON public.calendar_accounts(user_id);
