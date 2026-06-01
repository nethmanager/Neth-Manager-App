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
    const { email_id, folder_id, remove_inbox = false } = body
    if (!email_id || !folder_id) {
      return new Response(JSON.stringify({ error: 'email_id and folder_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load email and folder
    const { data: email, error: emailError } = await supabaseAdmin
      .from('emails')
      .select('*, account:email_accounts(*)')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single()

    const { data: folder, error: folderError } = await supabaseAdmin
      .from('email_folders')
      .select('*')
      .eq('id', folder_id)
      .eq('user_id', user.id)
      .single()

    if (emailError || !email || folderError || !folder) {
      return new Response(JSON.stringify({ error: 'Email or folder not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const account = email.account
    if (!account || account.provider !== 'gmail') {
      return new Response(JSON.stringify({ error: 'Only Gmail emails can be routed via this function' }), {
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
        await supabaseAdmin.from('email_account_tokens').update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }).eq('email_account_id', account.id)
      } else {
        throw new Error('Failed to refresh Gmail token')
      }
    }

    // 1. Find or create label
    let labelId = folder.provider_label_id
    if (!labelId) {
      const labelsRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const labelsData = await labelsRes.json()
      const existingLabel = labelsData.labels.find((l: any) => l.name.toLowerCase() === folder.name.toLowerCase())
      
      if (existingLabel) {
        labelId = existingLabel.id
      } else {
        const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: folder.name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
        })
        const createData = await createRes.json()
        if (createRes.ok) {
          labelId = createData.id
        } else {
          throw new Error('Failed to create Gmail label: ' + (createData.error?.message || createRes.statusText))
        }
      }

      // Update folder with provider_label_id
      await supabaseAdmin.from('email_folders').update({ provider_label_id: labelId }).eq('id', folder.id)
    }

    // 2. Modify message
    const modifyBody: any = {
      addLabelIds: [labelId]
    }
    if (remove_inbox) {
      modifyBody.removeLabelIds = ['INBOX']
    }

    const modifyRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.provider_message_id}/modify`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modifyBody)
    })

    if (!modifyRes.ok) {
      const errorData = await modifyRes.json().catch(() => ({}))
      throw new Error(`Gmail API Modify Error: ${errorData.error?.message || modifyRes.statusText}`)
    }

    // Update email row
    await supabaseAdmin.from('emails').update({ folder_id: folder.id }).eq('id', email_id)

    // Log action
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'gmail_route_email',
      entity_type: 'email',
      entity_id: email.id,
      details: { folder_name: folder.name, remove_inbox }
    })

    return new Response(JSON.stringify({ success: true, label_id: labelId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Gmail Routing Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
