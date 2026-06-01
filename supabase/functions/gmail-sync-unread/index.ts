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
    if (userError || !user) throw new Error('Unauthorized')

    // Find Gmail accounts
    const { data: accounts, error: accError } = await supabaseAdmin
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .eq('status', 'active')

    if (accError) throw accError
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ synced: 0, accounts: 0, routed: 0, message: 'No Gmail accounts found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load routing rules
    const { data: rules } = await supabaseAdmin
      .from('email_routing_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    let totalSynced = 0
    let totalRouted = 0
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    for (const account of accounts) {
      // Load corresponding token
      const { data: tokenRecord, error: tokenError } = await supabaseAdmin
        .from('email_account_tokens')
        .select('*')
        .eq('email_account_id', account.id)
        .single()

      if (tokenError || !tokenRecord) {
        console.error(`Token record not found for ${account.email_address}`)
        continue
      }

      let accessToken = tokenRecord.access_token
      
      // Refresh token if expired
      if (new Date(tokenRecord.token_expires_at) <= new Date()) {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
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
          console.error(`Could not refresh token for ${account.email_address}`)
          continue
        }
      }

      // Sync unread messages
      const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread%20in:inbox', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const listData = await listResponse.json()
      
      if (listData.messages) {
        for (const meta of listData.messages) {
          const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${meta.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          const msg = await msgResponse.json()
          
          const headers = msg.payload.headers
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)'
          const sender = headers.find((h: any) => h.name === 'From')?.value || ''
          const recipient = headers.find((h: any) => h.name === 'To')?.value || ''
          const receivedAt = new Date(parseInt(msg.internalDate)).toISOString()
          
          // Basic body extraction
          let bodyText = msg.snippet
          if (msg.payload.parts) {
            const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain')
            if (textPart && textPart.body && textPart.body.data) {
              bodyText = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))
            }
          }

          // Apply routing rules
          let folderId = null;
          if (rules && rules.length > 0) {
            const userRules = rules.filter(r => r.email_account_id === null || r.email_account_id === account.id);
            for (const rule of userRules) {
              let targetValue = '';
              if (rule.field === 'sender') targetValue = sender;
              else if (rule.field === 'subject') targetValue = subject;
              else if (rule.field === 'snippet') targetValue = msg.snippet;
              else if (rule.field === 'body_text') targetValue = bodyText;
              
              const pattern = rule.pattern.toLowerCase();
              const val = targetValue.toLowerCase();
              let matched = false;

              if (rule.match_type === 'contains') matched = val.includes(pattern);
              else if (rule.match_type === 'equals') matched = val === pattern;
              else if (rule.match_type === 'starts_with') matched = val.startsWith(pattern);
              else if (rule.match_type === 'regex') {
                try {
                  const re = new RegExp(rule.pattern, 'i');
                  matched = re.test(targetValue);
                } catch (e) {
                  console.error('Invalid regex in rule:', rule.id, e);
                }
              }

              if (matched) {
                folderId = rule.folder_id;
                totalRouted++;
                break;
              }
            }
          }

          const { error: upsertError } = await supabaseAdmin.from('emails').upsert({
            user_id: user.id,
            account_id: account.id,
            provider_message_id: msg.id,
            provider_thread_id: msg.threadId,
            provider_labels: msg.labelIds,
            sender,
            recipient,
            subject,
            snippet: msg.snippet,
            body_text: bodyText,
            received_at: receivedAt,
            is_read: false,
            status: 'new',
            folder_id: folderId,
            raw_payload: {
              sizeEstimate: msg.sizeEstimate,
              labelIds: msg.labelIds,
              historyId: msg.historyId,
              mimeType: msg.payload?.mimeType
            }
          }, { onConflict: 'account_id,provider_message_id' })

          if (!upsertError) totalSynced++
        }
      }

      await supabaseAdmin.from('email_accounts').update({
        last_synced_at: new Date().toISOString()
      }).eq('id', account.id)
    }

    return new Response(JSON.stringify({ synced: totalSynced, accounts: accounts.length, routed: totalRouted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Gmail Sync Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
