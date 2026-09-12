import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// HMAC SHA-256 Signature Verification Helper
async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }
  const expectedHash = signatureHeader.substring(7).trim()
  const encoder = new TextEncoder()
  const keyData = encoder.encode(appSecret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const bodyData = encoder.encode(rawBody)
  const signatureBytes = await crypto.subtle.sign('HMAC', key, bodyData)
  const hashArray = Array.from(new Uint8Array(signatureBytes))
  const actualHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return actualHash.toLowerCase() === expectedHash.toLowerCase()
}

serve(async (req: Request) => {
  const url = new URL(req.url)

  // 1. GET Webhook Challenge Verification (Meta Webhook Setup)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const expectedVerifyToken = Deno.env.get('META_VERIFY_TOKEN') || ''

    console.log(`GET Webhook verification attempt. Mode: ${mode}, Token matched: ${token === expectedVerifyToken}`)

    if (mode === 'subscribe' && token && expectedVerifyToken && token === expectedVerifyToken) {
      console.log('Meta Webhook verification SUCCESS!')
      return new Response(challenge || '', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    console.error('Meta Webhook verification FAILED: Invalid token or mode')
    return new Response('Forbidden: Verification token mismatch', { status: 403 })
  }

  // 2. POST Webhook Event Processing
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text()
      const signatureHeader = req.headers.get('X-Hub-Signature-256')
      const appSecret = Deno.env.get('META_APP_SECRET') || ''

      // Validate signature if secret is configured
      if (appSecret) {
        const isValid = await verifyMetaSignature(rawBody, signatureHeader, appSecret)
        if (!isValid) {
          console.error('Invalid Meta X-Hub-Signature-256 header!')
          return new Response('Unauthorized: Invalid HMAC Signature', { status: 401 })
        }
      } else {
        console.warn('META_APP_SECRET is not set in environment variables. Signature verification skipped.')
      }

      const body = JSON.parse(rawBody)

      // Verify event is page object
      if (body.object !== 'page') {
        return new Response('Event Object Not Supported', { status: 404 })
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const targetPageId = Deno.env.get('META_PAGE_ID') || ''
      const graphApiVersion = Deno.env.get('META_GRAPH_API_VERSION') || 'v21.0'
      const pageAccessToken = Deno.env.get('META_PAGE_ACCESS_TOKEN') || ''

      // Process batched entries
      for (const entry of body.entry || []) {
        const entryPageId = entry.id
        if (targetPageId && entryPageId !== targetPageId) {
          console.warn(`Skipping entry for Page ID ${entryPageId} (configured for ${targetPageId})`)
          continue
        }

        const messagingEvents = entry.messaging || []
        for (const messaging of messagingEvents) {
          if (!messaging.message) {
            // Non-message event (e.g. delivery receipt, read receipt, postback without text)
            continue
          }

          const messageObj = messaging.message
          const isEcho = Boolean(messageObj.is_echo)
          const metaMid = messageObj.mid

          // Determine customer PSID and direction
          let psid: string
          let direction: 'inbound' | 'outbound'

          if (isEcho) {
            // Echo: recipient is the customer PSID, sender is Page
            psid = messaging.recipient?.id
            direction = 'outbound'
          } else {
            // Customer message: sender is customer PSID, recipient is Page
            psid = messaging.sender?.id
            direction = 'inbound'
          }

          if (!psid) {
            console.error('Missing PSID in messaging event')
            continue
          }

          const messageText = messageObj.text || null
          const rawAttachments = messageObj.attachments || []
          const formattedAttachments = rawAttachments.map((att: any) => ({
            type: att.type,
            url: att.payload?.url || null,
            title: att.title || null
          }))

          // Check if conversation exists
          let { data: conversation } = await supabase
            .from('facebook_conversations')
            .select('*')
            .eq('page_id', entryPageId)
            .eq('psid', psid)
            .maybeSingle()

          // If conversation doesn't exist, create it
          if (!conversation) {
            let customerName: string | null = null
            let customerProfilePic: string | null = null

            // Optional profile lookup via Meta Graph API if access token is available
            if (pageAccessToken && !isEcho) {
              try {
                const profileRes = await fetch(
                  `https://graph.facebook.com/${graphApiVersion}/${psid}?fields=name,profile_pic&access_token=${pageAccessToken}`
                )
                if (profileRes.ok) {
                  const profileData = await profileRes.json()
                  customerName = profileData.name || null
                  customerProfilePic = profileData.profile_pic || null
                }
              } catch (profileErr) {
                console.warn('Failed to fetch Facebook profile:', profileErr)
              }
            }

            const { data: newConv, error: convErr } = await supabase
              .from('facebook_conversations')
              .insert({
                page_id: entryPageId,
                psid: psid,
                customer_name: customerName,
                customer_profile_pic: customerProfilePic,
                last_message_text: messageText || (formattedAttachments.length ? `[Attachment: ${formattedAttachments[0].type}]` : 'Media message'),
                last_message_at: new Date().toISOString(),
                last_customer_activity_at: !isEcho ? new Date().toISOString() : new Date().toISOString(),
                unread_count: !isEcho ? 1 : 0
              })
              .select()
              .single()

            if (convErr) {
              console.error('Error creating conversation:', convErr)
              continue
            }
            conversation = newConv
          } else {
            // Update existing conversation timestamps and preview text
            const updates: any = {
              last_message_text: messageText || (formattedAttachments.length ? `[Attachment: ${formattedAttachments[0].type}]` : 'Media message'),
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }

            if (!isEcho) {
              updates.last_customer_activity_at = new Date().toISOString()
              updates.unread_count = (conversation.unread_count || 0) + 1
            }

            await supabase
              .from('facebook_conversations')
              .update(updates)
              .eq('id', conversation.id)
          }

          // Check if message with meta_message_id already exists (deduplication)
          if (metaMid) {
            const { data: existingMsg } = await supabase
              .from('facebook_messages')
              .select('id')
              .eq('meta_message_id', metaMid)
              .maybeSingle()

            if (existingMsg) {
              console.log(`Message ${metaMid} already processed. Skipping duplicate.`)
              continue
            }
          }

          // Insert new message
          const { error: msgErr } = await supabase
            .from('facebook_messages')
            .insert({
              conversation_id: conversation.id,
              page_id: entryPageId,
              psid: psid,
              direction: direction,
              meta_message_id: metaMid || null,
              content: messageText,
              attachments: formattedAttachments,
              status: 'sent',
              is_echo: isEcho,
              timestamp_ms: messaging.timestamp || Date.now()
            })

          if (msgErr) {
            console.error('Error storing message:', msgErr)
          } else {
            console.log(`Successfully stored ${direction} Meta message ${metaMid || ''} for PSID ${psid}`)
          }
        }
      }

      // Promptly acknowledge Meta with 200 OK
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (err) {
      console.error('Error processing POST Meta webhook:', err)
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
})
