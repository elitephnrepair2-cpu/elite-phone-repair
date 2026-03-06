
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
  console.log("SMS ROUTING INPUT", {
    messageType,
    customerId: customer?.id,
    transactional: customer?.transactional_sms_consent,
    marketing: customer?.marketing_sms_consent,
    activeTicketsCount: activeTickets?.length,
  });

  const hasActiveTicket = activeTickets.some(t => !t.is_paid); // Logic: Unpaid tickets are active
  
  // Rule 1: Transactional Logic (Consent OR Active Relationship)
  const canSendTransactional = !!customer.transactional_sms_consent || hasActiveTicket;
  
  // Rule 2: Marketing Logic (Strict Consent Only)
  const canSendMarketing = !!customer.marketing_sms_consent;

  if (messageType === 'transactional') {
    if (canSendTransactional) {
      return { shouldSend: true };
    }
    return { 
      shouldSend: false, 
      reason: 'No transactional consent and no active repair tickets found. Transactional messages require an active service relationship or explicit consent.' 
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

  if (messageType === 'combined') {
    const splitMessages: { type: 'transactional' | 'marketing'; content: string }[] = [];
    
    // Evaluate Transactional Component
    if (canSendTransactional) {
      splitMessages.push({ 
        type: 'transactional', 
        content: '[SYSTEM: Transactional Component] ' + content 
      });
    }
    
    // Evaluate Marketing Component
    if (canSendMarketing) {
      splitMessages.push({ 
        type: 'marketing', 
        content: '[SYSTEM: Marketing Component] ' + content 
      });
    }

    if (splitMessages.length === 0) {
      return { 
        shouldSend: false, 
        reason: 'Consent denied for both transactional and marketing components. No messages will be sent.' 
      };
    }

    return { 
      shouldSend: true, 
      splitMessages 
    };
  }

  return { shouldSend: false, reason: 'Unknown message type.' };
};

/**
 * Invokes the Supabase Edge Function 'send-sms' (Twilio version)
 */
export const sendSmsViaEdgeFunction = async (payload: {
  customer_id: string;
  message_type: 'transactional' | 'marketing';
  content: string;
  ticket_id: string | null;
}) => {
  console.log("INVOKING EDGE FUNCTION 'send-sms'", payload);
  
  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: payload
    });

    if (error) {
      console.error("EDGE FUNCTION FAILED:", error);
      return { success: false, error };
    }

    console.log("EDGE FUNCTION SUCCEEDED:", data);
    return { success: true, data };
  } catch (err) {
    console.error("EDGE FUNCTION EXCEPTION:", err);
    return { success: false, error: err };
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
    return { success: true, results };
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
