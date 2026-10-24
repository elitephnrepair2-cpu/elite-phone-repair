// Pure policy shared by the browser and server; the database rechecks current consent.
export type SmsConsent = {
  transactional_sms_consent?: boolean | null; marketing_sms_consent?: boolean | null;
  revoked_at?: string | null; revoked_reason?: string | null;
};
export function canSendSms(customer: SmsConsent | null | undefined, type: 'transactional' | 'marketing'): boolean {
  if (!customer || (customer.revoked_at && customer.revoked_reason !== 'User opted out via UI')) return false;
  return type === 'marketing' ? customer.marketing_sms_consent === true : customer.transactional_sms_consent === true;
}
export function inboundOptOut(body: string, providerType?: string): 'STOP' | 'START' | 'HELP' | null {
  if (['STOP','START','HELP'].includes(providerType || '')) return providerType as 'STOP' | 'START' | 'HELP';
  const keyword = body.trim().toLowerCase();
  if (['stop','stopall','unsubscribe','cancel','end','quit','revoke','optout'].includes(keyword)) return 'STOP';
  if (['start','unstop'].includes(keyword)) return 'START';
  return keyword === 'help' ? 'HELP' : null;
}

export function appointmentSmsExpired(date: string, jobType: string, scheduledFor: string, timezone: string, now = new Date()): boolean {
  const scheduled = Date.parse(scheduledFor);
  if (!Number.isFinite(scheduled) || now.getTime() - scheduled > 86400000) return true;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  return jobType !== 'missed_appointment' && date < today;
}
