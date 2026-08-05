import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("Received payload:", JSON.stringify(payload))

    // Webhooks send table event info inside payload.record (for INSERT/UPDATE)
    const record = payload.record
    if (!record) {
      throw new Error("No record found in the webhook payload.")
    }

    const {
      customer_name,
      phone,
      brand,
      model,
      issue,
      price,
      location,
      notes
    } = record

    // Build notification SMS content
    const locationText = location ? ` at ${location}` : ""
    const priceText = price ? `\nEst. Cost: $${price}` : ""
    const notesText = notes ? `\nNotes: ${notes}` : ""
    const content = `🔔 New Website Quote Request${locationText}:\n\n👤 Name: ${customer_name || 'Anonymous'}\n📞 Phone: ${phone || 'N/A'}\n📱 Device: ${brand || ''} ${model || ''}\n🔧 Issue: ${issue || 'N/A'}${priceText}${notesText}`

    // Fetch Twilio credentials from env
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

    // Determine recipients based on the quote's location
    let toNumber = ""
    const normalizedLocation = (location || "").toLowerCase().trim()
    
    if (normalizedLocation === "houston") {
      toNumber = Deno.env.get('HOUSTON_NOTIFIED_PHONE_NUMBERS') || ""
      console.log("Routing to Houston notifications list.")
    } else if (normalizedLocation === "beaumont") {
      toNumber = Deno.env.get('BEAUMONT_NOTIFIED_PHONE_NUMBERS') || ""
      console.log("Routing to Beaumont notifications list.")
    }

    // Fallback if location-specific setting is empty
    if (!toNumber) {
      toNumber = Deno.env.get('STAFF_NOTIFIED_PHONE_NUMBER') || ""
      console.log("Using default fallback notification number.")
    }

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      throw new Error("Missing Twilio credentials or notification phone number env variables.")
    }

    // Support comma-separated phone numbers
    const recipients = toNumber.split(',').map(num => {
      const rawDigits = num.replace(/\D/g, '')
      if (rawDigits.length === 10) {
        return `+1${rawDigits}`
      } else if (rawDigits.length === 11 && rawDigits.startsWith('1')) {
        return `+${rawDigits}`
      } else {
        return `+${rawDigits}`
      }
    }).filter(num => num.length > 2)

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    
    // Send SMS to all recipients concurrently
    const sendPromises = recipients.map(async (recipientPhone) => {
      const formData = new URLSearchParams()
      formData.append('To', recipientPhone)
      formData.append('From', fromNumber)
      formData.append('Body', content)

      console.log(`Sending notification SMS to ${recipientPhone}...`)

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      })

      const twilioData = await twilioResponse.json()

      if (!twilioResponse.ok) {
        throw new Error(`Twilio error for ${recipientPhone}: ${twilioData.message || 'Unknown error'}`)
      }

      console.log(`Successfully sent SMS to ${recipientPhone}. SID: ${twilioData.sid}`)
      return twilioData.sid
    })

    const sids = await Promise.all(sendPromises)

    return new Response(
      JSON.stringify({ ok: true, status: 'sent', message_ids: sids }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Error in notify-new-quote function:", error.message)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
