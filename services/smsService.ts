import { canSendSms } from '../supabase/functions/_shared/smsPolicy';

import { Customer, RepairTicket } from '../types';
import { supabase } from '../supabaseClient';

export type MessageType = 'transactional' | 'marketing' | 'combined';

interface MessageRoutingResult {
  shouldSend: boolean;
  reason?: string;
  splitMessages?: { type: 'transactional' | 'marketing'; content: string }[];
}

/**
 * Determines if an SMS can be sent based on customer consent and active ticket status.
 */
export const evaluateSmsRouting = (
  customer: Customer,
  messageType: MessageType,
  content: string,
  activeTickets: RepairTicket[] = []
): MessageRoutingResult => {
  const canSendTransactional = canSendSms(customer, 'transactional');
  const canSendMarketing = canSendSms(customer, 'marketing');

  if (messageType === 'transactional') {
    if (canSendTransactional) {
      return { shouldSend: true };
    }
    return { 
      shouldSend: false, 
      reason: 'Transactional messages are disabled for this customer because they explicitly opted out.' 
    };
  }

  if (messageType === 'marketing') {
    if (canSendMarketing) {
      return { shouldSend: true };
    }
    return { 
      shouldSend: false, 
      reason: 'Marketing consent not granted. Marketing messages require explicit opt-in.' 
    };
  }

  // A combined body contains marketing. Never send that body under a transactional label,
  // or split the same full body into two duplicate messages.
  if (messageType === 'combined') {
    return canSendMarketing
      ? { shouldSend:true, splitMessages:[{ type:'marketing', content }] }
      : { shouldSend:false, reason:'Marketing consent is required for a message containing promotions.' };
  }

  return { shouldSend: false, reason: 'Unknown message type.' };
};

/**
 * Invokes the Supabase Edge Function 'send-sms' (Twilio version)
 */
export const sendSmsViaEdgeFunction = async (payload: {
  customer_id?: string;
  to_phone?: string;
  idempotency_key?: string;
  message_type: 'transactional' | 'marketing';
  content: string;
  ticket_id?: string | null;
  campaign_id?: string;
}) => {
  // Keep the same key if the browser loses the response. A user retry must not
  // silently submit a second provider request after an ambiguous first attempt.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const cacheKey = 'crm.sms.pending.' + Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
  let key = payload.idempotency_key || crypto.randomUUID();
  try {
    const saved = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (!payload.idempotency_key && saved && saved.expires > Date.now()) key = saved.key;
    sessionStorage.setItem(cacheKey, JSON.stringify({ key, expires:Date.now() + 86400000 }));
  } catch { /* Storage may be unavailable; this request still carries its send key. */ }
  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body:{ ...payload, idempotency_key:key }
    });
    if (error || !data) return { success:false, status:'uncertain', error:'Could not confirm send outcome. Check message history before retrying.' };
    if (['sent','failed','skipped'].includes(data.status)) {
      try { sessionStorage.removeItem(cacheKey); } catch { /* Storage may be unavailable. */ }
    }
    if (data.ok !== true || data.status !== 'sent') {
      return { success:false, status:data.status, reason:data.reason || data.error, data };
    }
    return { success:true, data };
  } catch {
    return { success:false, status:'uncertain', error:'Could not confirm send outcome. Check message history before retrying.' };
  }
};

/**
 * Main function to evaluate routing and automatically send SMS if allowed.
 */
export const sendSmsIfAllowed = async (
  customer: Customer,
  messageType: MessageType,
  content: string,
  activeTickets: RepairTicket[] = []
) => {
  const routing = evaluateSmsRouting(customer, messageType, content, activeTickets);

  if (!routing.shouldSend) {
    console.log("ROUTING DENIED:", routing.reason);
    return { success: false, reason: routing.reason };
  }

  console.log("ROUTING ALLOWED - Proceeding to send SMS");

  const ticketId = activeTickets.find(t => !t.is_paid)?.id || null;

  // Handle combined messages (split into multiple calls)
  if (messageType === 'combined' && routing.splitMessages) {
    const results = [];
    for (const msg of routing.splitMessages) {
      const res = await sendSmsViaEdgeFunction({
        customer_id: customer.id,
        message_type: msg.type,
        content: msg.content,
        ticket_id: ticketId
      });
      results.push(res);
    }
    return { success: results.every(result => result.success), results };
  }

  // Handle single message (transactional or marketing)
  const result = await sendSmsViaEdgeFunction({
    customer_id: customer.id,
    message_type: messageType as 'transactional' | 'marketing',
    content: content,
    ticket_id: ticketId
  });

  return { success: result.success, result };
};

/**
 * Helper to check if a customer has any open tickets in Supabase
 */
export const hasOpenTickets = (tickets: RepairTicket[]): boolean => {
  return tickets.some(t => !t.is_paid);
};
