import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getFreshAccessToken(supabaseAdmin: any, account: any, tokenRecord: any) {
  let accessToken = tokenRecord.access_token
  if (accessToken && tokenRecord.token_expires_at && new Date(tokenRecord.token_expires_at) > new Date()) {
    return accessToken
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('Google client configurations are missing for refreshing tokens')
  }

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
  if (!refreshData.access_token) {
    throw new Error('Failed to refresh Google Calendar token: ' + JSON.stringify(refreshData))
  }

  accessToken = refreshData.access_token
  await supabaseAdmin.from('calendar_account_tokens').update({
    access_token: accessToken,
    token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }).eq('calendar_account_id', account.id)

  return accessToken
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
    const { calendar_event_id } = body
    if (!calendar_event_id) {
      return new Response(JSON.stringify({ error: 'calendar_event_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: existingEvent, error: eventError } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('id', calendar_event_id)
      .eq('user_id', user.id)
      .single()

    if (eventError || !existingEvent) {
      return new Response(JSON.stringify({ error: 'Calendar event not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('calendar_accounts')
      .select('*')
      .eq('id', existingEvent.calendar_account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Calendar account not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('calendar_account_tokens')
      .select('*')
      .eq('calendar_account_id', account.id)
      .single()

    if (tokenError || !tokenRecord) {
      return new Response(JSON.stringify({ error: 'Account tokens not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = await getFreshAccessToken(supabaseAdmin, account, tokenRecord)

    const deleteResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingEvent.provider_calendar_id || 'primary')}/events/${encodeURIComponent(existingEvent.provider_event_id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!deleteResponse.ok && deleteResponse.status !== 410) {
      const errorData = await deleteResponse.json().catch(() => ({}))
      throw new Error(`Google Calendar API Delete Error: ${errorData.error?.message || deleteResponse.statusText}`)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', existingEvent.id)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'google_calendar_delete_event',
      entity_type: 'calendar_event',
      entity_id: existingEvent.id,
      details: { title: existingEvent.title, google_event_id: existingEvent.provider_event_id }
    })

    return new Response(JSON.stringify({ event: existingEvent, deleted: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Google Calendar Delete Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
