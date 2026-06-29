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
    const { calendar_event_id, title, description, location, start_at, end_at, all_day, status, time_zone } = body

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

    let activeTimeZone = 'America/Cancun'
    if (typeof time_zone === 'string' && time_zone.trim()) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: time_zone })
        activeTimeZone = time_zone
      } catch (_) {}
    }

    const accessToken = await getFreshAccessToken(supabaseAdmin, account, tokenRecord)

    const nextStart = start_at || existingEvent.start_at
    const nextEnd = end_at || existingEvent.end_at
    const nextAllDay = all_day !== undefined ? !!all_day : !!existingEvent.all_day

    const googleBody: any = {
      summary: title !== undefined ? title : existingEvent.title,
      description: description !== undefined ? description || undefined : existingEvent.description || undefined,
      location: location !== undefined ? location || undefined : existingEvent.location || undefined,
      start: nextAllDay ? { date: String(nextStart).substring(0, 10) } : { dateTime: nextStart, timeZone: activeTimeZone },
      end: nextAllDay ? { date: String(nextEnd).substring(0, 10) } : { dateTime: nextEnd, timeZone: activeTimeZone },
      status: status || existingEvent.status || 'confirmed'
    }

    const updateResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingEvent.provider_calendar_id || 'primary')}/events/${encodeURIComponent(existingEvent.provider_event_id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(googleBody)
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      throw new Error(`Google Calendar API Update Error: ${errorData.error?.message || updateResponse.statusText}`)
    }

    const item = await updateResponse.json()
    const startAtMapped = item.start?.dateTime || (item.start?.date ? `${item.start.date}T12:00:00.000Z` : nextStart)
    const endAtMapped = item.end?.dateTime || (item.end?.date ? `${item.end.date}T12:00:00.000Z` : nextEnd)

    const { data: savedEvent, error: updateError } = await supabaseAdmin
      .from('calendar_events')
      .update({
        title: item.summary || googleBody.summary,
        description: item.description || null,
        location: item.location || null,
        start_at: startAtMapped,
        end_at: endAtMapped,
        all_day: !!item.start?.date,
        status: item.status || googleBody.status,
        html_link: item.htmlLink || existingEvent.html_link || null,
        attendees: item.attendees || existingEvent.attendees || [],
        raw_payload: item,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingEvent.id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'google_calendar_update_event',
      entity_type: 'calendar_event',
      entity_id: savedEvent.id,
      details: { title: savedEvent.title, start_at: savedEvent.start_at, google_event_id: existingEvent.provider_event_id }
    })

    return new Response(JSON.stringify({ event: savedEvent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Google Calendar Update Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
