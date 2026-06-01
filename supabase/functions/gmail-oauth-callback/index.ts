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

    const { user_id: userId, business_ids: businessIds, display_color, display_name } = stateData

    // Delete state after use
    await supabaseAdmin.from('oauth_states').delete().eq('id', stateData.id)

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')
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

    // Get user profile
    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const profile = await profileResponse.json()

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    // Upsert email account (public info)
    const { data: account, error: upsertError } = await supabaseAdmin
      .from('email_accounts')
      .upsert({
        user_id: userId,
        email_address: profile.emailAddress,
        provider: 'gmail',
        provider_account_id: profile.emailAddress,
        display_color: display_color || '#3b82f6',
        display_name: display_name || null,
        status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider_account_id' })
      .select()
      .single()

    if (upsertError) throw upsertError

    // Load existing token to preserve refresh_token if not provided (Google only sends it once unless prompt=consent)
    const { data: existingToken } = await supabaseAdmin
      .from('email_account_tokens')
      .select('refresh_token')
      .eq('email_account_id', account.id)
      .maybeSingle()

    // Upsert tokens (restricted table)
    const { error: tokenUpsertError } = await supabaseAdmin
      .from('email_account_tokens')
      .upsert({
        email_account_id: account.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || existingToken?.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email_account_id' })

    if (tokenUpsertError) throw tokenUpsertError

    // Link businesses
    if (businessIds && businessIds.length > 0) {
      await supabaseAdmin.from('email_account_businesses').delete().eq('email_account_id', account.id);
      const links = businessIds.map((bid: string) => ({
        user_id: userId,
        email_account_id: account.id,
        business_id: bid
      }));
      await supabaseAdmin.from('email_account_businesses').insert(links);
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/emails?gmail=connected` }
    })

  } catch (error) {
    console.error('OAuth Callback Error:', error)
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
})
