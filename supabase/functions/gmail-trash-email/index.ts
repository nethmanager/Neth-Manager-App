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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json().catch(() => ({}))
    const { email_id } = body
    if (!email_id) {
      return new Response(JSON.stringify({ error: 'email_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load email and check ownership
    const { data: email, error: emailError } = await supabaseAdmin
      .from('emails')
      .select('*, account:email_accounts(*)')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single()

    if (emailError || !email) {
      return new Response(JSON.stringify({ error: 'Email not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!email.provider_message_id) {
      return new Response(JSON.stringify({ error: 'Email missing provider message ID, cannot trash via Gmail API' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const account = email.account
    if (!account || account.provider !== 'gmail') {
      return new Response(JSON.stringify({ error: 'Only Gmail emails can be trashed via this function' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load tokens
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
       .from('email_account_tokens')
       .select('*')
       .eq('email_account_id', account.id)
       .single()

    if (tokenError || !tokenRecord) {
      return new Response(JSON.stringify({ error: 'Account tokens not found in database. Reconnect your account.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let accessToken = tokenRecord.access_token
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth environment variables')
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Google OAuth credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Refresh if needed
    if (!accessToken || !tokenRecord.token_expires_at || new Date(tokenRecord.token_expires_at) <= new Date()) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenRecord.refresh_token,
          grant_type: 'refresh_token'
        })
      })
      
      const refreshData = await refreshResponse.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        await supabaseAdmin.from('email_account_tokens').update({
          access_token: accessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }).eq('email_account_id', account.id)
      } else {
        return new Response(JSON.stringify({ 
          error: 'Failed to refresh Gmail token',
          details: refreshData.error_description || refreshData.error
        }), {
          status: refreshResponse.status === 400 ? 401 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Call Gmail Trash API
    const trashResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.provider_message_id}/trash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!trashResponse.ok) {
      const errorData = await trashResponse.json().catch(() => ({}))
      return new Response(JSON.stringify({ 
        error: `Gmail API error: ${errorData.error?.message || trashResponse.statusText}` 
      }), {
        status: trashResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update local email status
    await supabaseAdmin.from('emails').update({
      status: 'archived',
      is_read: true
    }).eq('id', email_id)

    // Log action
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'gmail_trash_email',
      entity_type: 'email',
      entity_id: email_id,
      details: { provider_message_id: email.provider_message_id }
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Gmail Trash Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
