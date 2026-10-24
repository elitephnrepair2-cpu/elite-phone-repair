// All customer-facing outbound paths use this gate. A durable receipt is committed
// before Twilio is called. Ambiguous outcomes are never automatically retried.
export type SmsRequest = {
  customer_id?: string | null; to_phone?: string; message_type?: string;
  content: string; ticket_id?: string | null; campaign_id?: string | null;
  automation_id?: string | null; idempotency_key?: string;
};
export type SmsResult = { ok: boolean; status: string; reason?: string; message_id?: string; duplicate?: boolean };
type Dependencies = {
  fetch?: typeof fetch;
  env?: (key: string) => string | undefined;
};

export async function dispatchSms(db: any, input: SmsRequest, dependencies: Dependencies = {}): Promise<SmsResult> {
  const env = dependencies.env ?? ((key: string) => Deno.env.get(key));
  const accountSid = env('TWILIO_ACCOUNT_SID');
  const authToken = env('TWILIO_AUTH_TOKEN');
  const from = env('TWILIO_FROM_NUMBER');
  if (!accountSid || !authToken || !from) throw new Error('Twilio configuration missing');
  const payload = {
    customer_id: input.customer_id || null, to_phone: input.to_phone || null,
    message_type: input.message_type ?? 'transactional', content: input.content,
    ticket_id: input.ticket_id || null, campaign_id: input.campaign_id || null,
    automation_id: input.automation_id || null,
  };
  if (!['transactional','marketing'].includes(payload.message_type) || typeof payload.content !== 'string' ||
      !payload.content.trim() || payload.content.length > 5000 || (!payload.customer_id && !payload.to_phone)) {
    throw new Error('Invalid SMS request');
  }
  // Marketing campaigns use one stable key per recipient, even if a client retries.
  const key = input.idempotency_key || (payload.campaign_id && payload.customer_id
    ? `campaign:${payload.campaign_id}:${payload.customer_id}` : `manual:${crypto.randomUUID()}`);
  if (typeof key !== 'string' || key.length < 8 || key.length > 200) throw new Error('Invalid send key');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const fingerprint = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2,'0')).join('');
  const { data: claim, error: claimError } = await db.rpc('crm_prepare_sms_dispatch', {
    p_key: key, p_fingerprint: fingerprint, p_customer_id: payload.customer_id,
    p_phone: payload.to_phone, p_type: payload.message_type, p_content: payload.content,
    p_ticket_id: payload.ticket_id, p_campaign_id: payload.campaign_id, p_automation_id: payload.automation_id,
  });
  if (claimError || !claim) throw new Error('Could not verify consent and reserve this send');
  if (!claim.claimed) return claim;

  let result: SmsResult;
  try {
    const response = await (dependencies.fetch ?? fetch)(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST', headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: claim.phone, From: from, Body: payload.content }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (response.ok && typeof data.sid === 'string' && data.sid) {
      result = { ok:true, status:'sent', message_id:data.sid };
    } else if (response.status >= 400 && response.status < 500) {
      result = { ok:false, status:'failed', reason:data.message || 'Twilio rejected this message' };
    } else {
      result = { ok:false, status:'uncertain', reason:'Provider outcome unknown. Review Twilio before retrying.' };
    }
  } catch {
    result = { ok:false, status:'uncertain', reason:'Provider outcome unknown. Review Twilio before retrying.' };
  }
  try {
    const { error } = await db.rpc('crm_finish_sms_dispatch', {
      p_key:claim.dispatch_key, p_state:result.status, p_provider_id:result.message_id || null, p_reason:result.reason || null,
    });
    if (error) throw error;
  } catch {
    // The receipt remains dispatching. Retrying this key cannot contact Twilio again.
    return { ok:false, status:'uncertain', reason:'Could not record provider outcome. Review Twilio before retrying.' };
  }
  return result;
}
