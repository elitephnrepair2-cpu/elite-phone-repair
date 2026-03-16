import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Using Production URL for live merchant accounts
const CLOVER_BASE_URL = 'https://api.clover.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const cloverAppId = Deno.env.get('CLOVER_APP_ID')
    const cloverAppSecret = Deno.env.get('CLOVER_APP_SECRET')

    if (!cloverAppId || !cloverAppSecret) {
      throw new Error("Missing Clover App ID or Secret in environment variables")
    }

    const requestData = await req.json()
    const { action, location } = requestData

    if (!location) {
      throw new Error("Missing location parameter");
    }
    const providerKey = `clover_${location.toLowerCase()}`;

    // ACTION: SAVE MANUAL API TOKEN AND MERCHANT ID
    if (action === 'save_manual_token') {
      const { access_token, merchant_id } = requestData

      if (!access_token || !merchant_id) {
        throw new Error("Missing access_token or merchant_id")
      }

      // Save securely to Supabase
      const { error: dbError } = await supabaseClient
        .from('integration_settings')
        .update({
          access_token: access_token,
          merchant_id: merchant_id,
          is_connected: true
        })
        .eq('provider', providerKey)

      // If no rows were updated, we might need to insert
      // But let's check if it exists or do an upsert
      const { data: existingData } = await supabaseClient
        .from('integration_settings')
        .select('id')
        .eq('provider', providerKey)
        .maybeSingle()

      if (!existingData) {
        await supabaseClient
          .from('integration_settings')
          .insert({
             provider: providerKey,
             access_token: access_token,
             merchant_id: merchant_id,
             is_connected: true
          })
      }

      if (dbError) throw dbError;

      return new Response(
        JSON.stringify({ ok: true, message: "Successfully connected to Clover via Manual Token!" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ACTION: GET DEVICES
    if (action === 'get_devices') {
      // 1. Get the current token and merchant_id from Database
      const { data: settings, error: settingsError } = await supabaseClient
        .from('integration_settings')
        .select('*')
        .eq('provider', providerKey)
        .single();

      if (settingsError || !settings || !settings.access_token) {
        throw new Error("Clover is not connected or settings not found");
      }

      const { merchant_id, access_token } = settings;

      // 2. Call Clover Device API
      const devicesResponse = await fetch(`${CLOVER_BASE_URL}/v3/merchants/${merchant_id}/devices`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const devicesData = await devicesResponse.json();

      if (!devicesResponse.ok) {
        throw new Error(devicesData.message || "Failed to fetch devices");
      }

      return new Response(
        JSON.stringify({ ok: true, devices: devicesData.elements || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ACTION: UPDATE SELECTED DEVICE
    if (action === 'save_device') {
      const { device_id } = requestData;
      if (!device_id) throw new Error("Missing device_id");

      const { error: updateError } = await supabaseClient
        .from('integration_settings')
        .update({ selected_device_id: device_id })
        .eq('provider', providerKey);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ACTION: SEND PAYMENT TO DEVICE
    if (action === 'send_payment') {
      const { amount, ticket_id } = requestData;
      if (!amount) throw new Error("Missing amount");

      // 1. Get settings
      const { data: settings, error: settingsError } = await supabaseClient
        .from('integration_settings')
        .select('*')
        .eq('provider', providerKey)
        .single();
        
      if (settingsError || !settings || !settings.access_token || !settings.selected_device_id) {
        throw new Error("Clover is not fully configured (missing token or device selection)");
      }

      // 2. Format amount to cents (integer)
      const amountInCents = Math.round(parseFloat(amount) * 100);

      // 3. Call Clover REST Pay Display API
      const payResponse = await fetch(`${CLOVER_BASE_URL}/v1/device/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.access_token}`,
          'X-Clover-Device-Id': settings.selected_device_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountInCents,
          externalPaymentId: ticket_id || `ticket-${Date.now()}`
        })
      });

      const payData = await payResponse.json();

      if (!payResponse.ok) {
        throw new Error(payData.message || "Failed to push payment to device");
      }

      return new Response(
        JSON.stringify({ ok: true, message: "Payment sent to device successfully", data: payData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error("Clover API Error:", error.message)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
