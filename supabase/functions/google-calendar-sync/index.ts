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

    // Get signed in user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    let body = {} as any
    try {
      body = await req.json()
    } catch {
      // Body empty/optional
    }

    const { time_min, time_max } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Load active google calendar accounts for this user
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('calendar_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('status', 'active')

    if (accountsError) throw accountsError
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, errors: [], message: 'No active Google Calendar accounts found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    let totalSynced = 0
const syncErrors: string[] = []

    for (const account of accounts) {
      // Get token details
      const { data: token, error: tokenError } = await supabaseAdmin
        .from('calendar_account_tokens')
        .select('*')
        .eq('calendar_account_id', account.id)
        .maybeSingle()

    if (tokenError || !token) {
  const message = `No tokens found for calendar account ${account.email_address || account.id}. Reconnect Google Calendar.`
  console.warn(message)
  syncErrors.push(message)
  continue
}

      let accessToken = token.access_token
      const isExpired = !token.token_expires_at || new Date(token.token_expires_at) <= new Date(Date.now() + 60000)

      if (isExpired && !token.refresh_token) {
  const message = `Google Calendar token expired for ${account.email_address || account.id}, and no refresh token is available. Reconnect Google Calendar.`
  console.error(message)
  syncErrors.push(message)
  await supabaseAdmin
    .from('calendar_accounts')
    .update({ status: 'error', updated_at: new Date().toISOString() })
    .eq('id', account.id)
  continue
}

      if (isExpired && token.refresh_token) {
        console.log(`Access token expired for calendar account ${account.id}. Refreshing...`)
        if (!clientId || !clientSecret) {
          throw new Error('Google client configurations are missing for refreshing tokens')
        }

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token.refresh_token,
            grant_type: 'refresh_token'
          })
        })

        const refreshData = await refreshResponse.json()
       if (refreshData.error) {
  const message = `Token refresh failed for ${account.email_address || account.id}: ${refreshData.error_description || refreshData.error}`
  console.error(message, refreshData)
  syncErrors.push(message)
  await supabaseAdmin
    .from('calendar_accounts')
    .update({ status: 'error', updated_at: new Date().toISOString() })
    .eq('id', account.id)
  continue
}

        accessToken = refreshData.access_token
        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

        const { error: tokenUpdateError } = await supabaseAdmin
          .from('calendar_account_tokens')
          .update({
            access_token: accessToken,
            token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('calendar_account_id', account.id)

        if (tokenUpdateError) {
          console.error(`Failed to save refreshed access token for ${account.id}:`, tokenUpdateError)
        }
      }

      // Fetch primary calendar events
      const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
      calendarUrl.searchParams.set('singleEvents', 'true')
      calendarUrl.searchParams.set('orderBy', 'startTime')
      calendarUrl.searchParams.set('maxResults', '250')

      if (time_min) {
        calendarUrl.searchParams.set('timeMin', time_min)
      } else {
        // Default to start of current month, or 30 days ago
        const defaultMin = new Date()
        defaultMin.setDate(defaultMin.getDate() - 30)
        calendarUrl.searchParams.set('timeMin', defaultMin.toISOString())
      }

      if (time_max) {
        calendarUrl.searchParams.set('timeMax', time_max)
      } else {
        // Default to 120 days from now
        const defaultMax = new Date()
        defaultMax.setDate(defaultMax.getDate() + 120)
        calendarUrl.searchParams.set('timeMax', defaultMax.toISOString())
      }

      const eventsResponse = await fetch(calendarUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      if (!eventsResponse.ok) {
  const errText = await eventsResponse.text()
  const message = `Failed to fetch Google Calendar events for ${account.email_address || account.id}: ${eventsResponse.status} ${errText}`
  console.error(message)
  syncErrors.push(message)
  continue
}

      const eventsData = await eventsResponse.json()
      const googleEvents = eventsData.items || []

      if (googleEvents.length > 0) {
        const eventsToUpsert = googleEvents.map((item: any) => {
          const allDay = !!item.start?.date
const startAt = item.start?.dateTime
  || (item.start?.date ? `${item.start.date}T12:00:00.000Z` : new Date().toISOString())
const endAt = item.end?.dateTime
  || (item.end?.date ? `${item.end.date}T12:00:00.000Z` : new Date().toISOString())

          return {
            user_id: user.id,
            calendar_account_id: account.id,
            provider: 'google',
            provider_calendar_id: 'primary',
            provider_event_id: item.id,
            title: item.summary || '(No Subject)',
            description: item.description || null,
            location: item.location || null,
            start_at: startAt,
            end_at: endAt,
            all_day: allDay,
            status: item.status || 'confirmed',
            html_link: item.htmlLink || null,
            attendees: item.attendees || [],
raw_payload: item,
            updated_at: new Date().toISOString()
          }
        })

        // Upsert events
        const { error: upsertError } = await supabaseAdmin
          .from('calendar_events')
          .upsert(eventsToUpsert, { onConflict: 'calendar_account_id,provider_calendar_id,provider_event_id' })

        if (upsertError) {
  const message = `Failed to save Google Calendar events for ${account.email_address || account.id}: ${upsertError.message}`
  console.error(message, upsertError)
  syncErrors.push(message)
} else {
  totalSynced += eventsToUpsert.length
}
      }

      // Update last_synced_at timestamp on account
      await supabaseAdmin
        .from('calendar_accounts')
        .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', account.id)
    }

    return new Response(
      JSON.stringify({ synced: totalSynced, errors: syncErrors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Calendar Sync Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

