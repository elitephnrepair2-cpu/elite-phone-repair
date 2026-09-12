import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { conversation_id, message_text, client_msg_id } = await req.json()

    if (!conversation_id || !message_text || !message_text.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: conversation_id and message_text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch conversation details
    const { data: conversation, error: convError } = await supabase
      .from('facebook_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single()

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Enforce Meta's Standard 24-Hour Messaging Window Policy
    const lastActivityTime = new Date(conversation.last_customer_activity_at).getTime()
    const nowTime = Date.now()
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

    if (nowTime - lastActivityTime > TWENTY_FOUR_HOURS_MS) {
      console.warn(`Attempted to send reply outside 24h window for conversation ${conversation_id}`)
      return new Response(
        JSON.stringify({
          error: '24-Hour Messaging Window Expired. Meta policy requires the customer to initiate activity within the last 24 hours before standard staff replies can be dispatched.',
          code: 'MESSAGING_WINDOW_EXPIRED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pageAccessToken = Deno.env.get('META_PAGE_ACCESS_TOKEN') || ''
    const graphApiVersion = Deno.env.get('META_GRAPH_API_VERSION') || 'v21.0'

    if (!pageAccessToken) {
      return new Response(
        JSON.stringify({ error: 'META_PAGE_ACCESS_TOKEN is not configured on the server.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Dispatch to Meta Send API
    const metaSendUrl = `https://graph.facebook.com/${graphApiVersion}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`

    const metaPayload = {
      recipient: { id: conversation.psid },
      messaging_type: 'RESPONSE',
      message: {
        text: message_text.trim()
      }
    }

    console.log(`Sending Meta Messenger message to PSID ${conversation.psid}...`)

    const metaResponse = await fetch(metaSendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaPayload)
    })

    const metaResult = await metaResponse.json()

    if (!metaResponse.ok || metaResult.error) {
      console.error('Meta Send API error:', metaResult)
      const errorMsg = metaResult.error?.message || 'Meta API request failed'

      // Log failed message attempt in DB
      await supabase
        .from('facebook_messages')
        .insert({
          conversation_id: conversation.id,
          page_id: conversation.page_id,
          psid: conversation.psid,
          direction: 'outbound',
          content: message_text.trim(),
          status: 'failed',
          error_message: errorMsg,
          is_echo: false,
          timestamp_ms: Date.now()
        })

      return new Response(
        JSON.stringify({ error: `Meta Error: ${errorMsg}`, meta_details: metaResult.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metaMessageId = metaResult.message_id

    // 3. Save Outbound Message & Update Conversation State
    const { data: insertedMsg, error: insertError } = await supabase
      .from('facebook_messages')
      .insert({
        conversation_id: conversation.id,
        page_id: conversation.page_id,
        psid: conversation.psid,
        direction: 'outbound',
        meta_message_id: metaMessageId,
        content: message_text.trim(),
        status: 'sent',
        is_echo: false,
        timestamp_ms: Date.now()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to log outbound message in DB:', insertError)
    }

    // Update conversation last message preview
    await supabase
      .from('facebook_conversations')
      .update({
        last_message_text: message_text.trim(),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id)

    return new Response(
      JSON.stringify({
        success: true,
        message_id: metaMessageId,
        message: insertedMsg
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Error sending Facebook Messenger reply:', err)
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
