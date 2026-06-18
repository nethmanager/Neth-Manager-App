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

    // Verify JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json().catch(() => ({}))
    const {
      calendar_account_id,
      title,
      description,
      location,
      start_at,
      end_at,
      all_day,
      time_zone
    } = body

    if (!calendar_account_id || !title || !start_at || !end_at) {
      return new Response(JSON.stringify({ error: 'calendar_account_id, title, start_at, and end_at are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let activeTimeZone = 'America/Cancun'
    if (typeof time_zone === 'string' && time_zone.trim()) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: time_zone })
        activeTimeZone = time_zone
      } catch (e) {
        // Fallback
      }
    }

    // Load calendar account row to verify ownership
    const { data: account, error: accountError } = await supabaseAdmin
      .from('calendar_accounts')
      .select('*')
      .eq('id', calendar_account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Calendar account not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load tokens
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

    let accessToken = tokenRecord.access_token
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    // Refresh token if needed
    if (!accessToken || !tokenRecord.token_expires_at || new Date(tokenRecord.token_expires_at) <= new Date()) {
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
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabaseAdmin.from('calendar_account_tokens').update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }).eq('calendar_account_id', account.id)
      } else {
        throw new Error('Failed to refresh Google Calendar token: ' + JSON.stringify(refreshData))
      }
    }

    // Call Google Calendar API events.insert
    const googleStart = all_day
      ? { date: start_at.substring(0, 10) }
      : { dateTime: start_at, timeZone: activeTimeZone }
    const googleEnd = all_day
      ? { date: end_at.substring(0, 10) }
      : { dateTime: end_at, timeZone: activeTimeZone }

    const insertResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        description: description || undefined,
        location: location || undefined,
        start: googleStart,
        end: googleEnd
      })
    })

    if (!insertResponse.ok) {
      const errorData = await insertResponse.json().catch(() => ({}))
      throw new Error(`Google Calendar API Insert Error: ${errorData.error?.message || insertResponse.statusText}`)
    }

    const item = await insertResponse.json()

    // Store returned event locally in calendar_events table
    const startAtMapped = item.start?.dateTime
      || (item.start?.date ? `${item.start.date}T12:00:00.000Z` : new Date(start_at).toISOString())
    const endAtMapped = item.end?.dateTime
      || (item.end?.date ? `${item.end.date}T12:00:00.000Z` : new Date(end_at).toISOString())

    const localEventToUpsert = {
      user_id: user.id,
      calendar_account_id: account.id,
      provider: 'google',
      provider_calendar_id: 'primary',
      provider_event_id: item.id,
      title: item.summary || title,
      description: item.description || description || null,
      location: item.location || location || null,
      start_at: startAtMapped,
      end_at: endAtMapped,
      all_day: !!item.start?.date,
      status: item.status || 'confirmed',
      html_link: item.htmlLink || null,
      attendees: item.attendees || [],
      raw_payload: item,
      updated_at: new Date().toISOString()
    }

    const { data: savedEventArr, error: upsertError } = await supabaseAdmin
      .from('calendar_events')
      .upsert(localEventToUpsert, { onConflict: 'calendar_account_id,provider_calendar_id,provider_event_id' })
      .select('*')

    if (upsertError) {
      console.warn('Failed to upsert created event locally (will fallback to direct insert):', upsertError)
      // Fallback direct insert
      const { data: fallbackEventArr, error: insertError } = await supabaseAdmin
        .from('calendar_events')
        .insert(localEventToUpsert)
        .select('*')
      
      if (insertError) {
        throw new Error('Google Calendar event created successfully but local database storage failed: ' + insertError.message)
      }
      
      const eventRow = fallbackEventArr?.[0]
      return new Response(JSON.stringify({ event: eventRow, provider_event_id: item.id, html_link: item.htmlLink }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const eventRow = savedEventArr?.[0] || localEventToUpsert

    // Log action
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'google_calendar_create_event',
      entity_type: 'calendar_event',
      entity_id: eventRow.id || null,
      details: { title, start_at, end_at, google_event_id: item.id }
    })

    return new Response(JSON.stringify({ event: eventRow, provider_event_id: item.id, html_link: item.htmlLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Google Calendar Creation Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
