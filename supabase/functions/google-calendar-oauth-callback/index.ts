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

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateStr = url.searchParams.get('state') 

  if (!code || !stateStr) {
    return new Response('Missing code or state', { status: 400 })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Lookup and verify state
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .select('*')
      .eq('state_token', stateStr)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (stateError || !stateData) {
      throw new Error('Invalid or expired state. Please try again.')
    }

    const { user_id: userId, display_color, display_name } = stateData

    // Delete state after use
    await supabaseAdmin.from('oauth_states').delete().eq('id', stateData.id)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') || Deno.env.get('GOOGLE_REDIRECT_URI')
    const appUrl = Deno.env.get('APP_URL')

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code'
      })
    })

    const tokenData = await tokenResponse.json()
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error)

    // Get user info from OpenID Connect userinfo endpoint
    const userinfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userinfo = await userinfoResponse.json()
    if (!userinfo.email) throw new Error('Failed to retrieve email from Google userinfo')

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Upsert calendar account (public info)
    const { data: account, error: upsertError } = await supabaseAdmin
      .from('calendar_accounts')
      .upsert({
        user_id: userId,
        provider: 'google',
        provider_account_id: userinfo.sub,
        email_address: userinfo.email,
        display_name: display_name || userinfo.name || userinfo.email,
        display_color: display_color || '#3b82f6',
        status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider,provider_account_id' })
      .select()
      .single()

    if (upsertError) throw upsertError

    // Load existing token to preserve refresh_token if not provided
    const { data: existingToken } = await supabaseAdmin
      .from('calendar_account_tokens')
      .select('refresh_token')
      .eq('calendar_account_id', account.id)
      .maybeSingle()

    // Upsert tokens (restricted)
    const { error: tokenUpsertError } = await supabaseAdmin
      .from('calendar_account_tokens')
      .upsert({
        calendar_account_id: account.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || existingToken?.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'calendar_account_id' })

    if (tokenUpsertError) throw tokenUpsertError

    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/schedule?calendar=connected` }
    })

  } catch (error: any) {
    console.error('Calendar OAuth Callback Error:', error)
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
})
