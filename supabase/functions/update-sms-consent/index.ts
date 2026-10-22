import { authorize } from '../_shared/authorization.ts';
import { serve, createClient } from "../_shared/runtime.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const denied = await authorize(req, { headers: corsHeaders });
  if (denied) return denied;

  try {
    // Initialize Supabase client with Service Role Key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { customer_id, phone, consent_type, status, source, notes } = await req.json()

    // Validation
    if ((!customer_id && !phone) || !consent_type || typeof status !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: (customer_id or phone), consent_type, status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare update object for the customers table
    const updateData: any = {
      consent_source: source || 'web',
      consent_method: 'checkbox', // Default for web/iPad
    }

    if (consent_type === 'marketing') {
      updateData.marketing_sms_consent = status
    } else if (consent_type === 'transactional') {
      updateData.transactional_sms_consent = status
    } else {
      throw new Error('Invalid consent_type. Must be "marketing" or "transactional".')
    }

    // Update the customer record
    // We use phone as a fallback identifier if customer_id isn't provided
    const query = supabaseClient.from('customers').update(updateData);
    
    if (customer_id) {
      query.eq('id', customer_id);
    } else {
      query.eq('phone', phone);
    }

    const { data: customer, error: updateError } = await query.select().single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        ok: true,
        success: true, 
        message: `SMS ${consent_type} consent updated to ${status}`,
        customer_id: customer.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Operation failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
