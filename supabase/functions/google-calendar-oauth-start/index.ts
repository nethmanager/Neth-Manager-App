import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    let body = {}
    try {
      body = await req.json()
    } catch {
      // Body may be empty, which is fine
    }
    const { business_ids, display_color, display_name } = body as any

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') || Deno.env.get('GOOGLE_REDIRECT_URI')
    const scope = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!clientId || !redirectUri) {
      throw new Error('Google configuration missing in Edge Function secrets')
    }

    const stateToken = crypto.randomUUID()
    const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
      state_token: stateToken,
      user_id: user.id,
      business_ids: business_ids || [],
      display_color: display_color || '#3b82f6',
      display_name: display_name || null
    })

    if (stateError) throw stateError

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', stateToken)
    authUrl.searchParams.set('include_granted_scopes', 'true')

    return new Response(
      JSON.stringify({ url: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
