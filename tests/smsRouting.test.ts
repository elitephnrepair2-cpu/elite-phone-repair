import { beforeEach, expect, it, vi } from 'vitest';
import { inboundOptOut, appointmentSmsExpired } from '../supabase/functions/_shared/smsPolicy';
const mocks=vi.hoisted(()=>({ invoke:vi.fn() }));
vi.mock('../supabaseClient',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
import { evaluateSmsRouting,sendSmsIfAllowed,sendSmsViaEdgeFunction } from '../services/smsService';
import { triggerAppointmentSmsProcessor } from '../services/appointmentSmsService';
const customer={id:'test-customer',transactional_sms_consent:true,marketing_sms_consent:true} as any;
let store: Map<string,string>;
beforeEach(()=>{
  vi.clearAllMocks(); store=new Map();
  vi.stubGlobal('sessionStorage',{ getItem:(key: string)=>store.get(key) || null,setItem:(key: string,value: string)=>store.set(key,value),removeItem:(key: string)=>store.delete(key) });
});
it('an active repair ticket never overrides a transactional opt-out',()=>{
  expect(evaluateSmsRouting({...customer,transactional_sms_consent:false},'transactional','Ready',[{id:'ticket'}] as any)).toMatchObject({shouldSend:false});
});
it.each(['transactional','marketing','combined'] as const)('revocation blocks %s messages in the browser',type=>{
  expect(evaluateSmsRouting({...customer,revoked_at:new Date().toISOString()},type,'Message')).toMatchObject({shouldSend:false});
});
it('combined content cannot bypass missing marketing consent',()=>{
  expect(evaluateSmsRouting({...customer,marketing_sms_consent:false},'combined','Ready! Also buy a case.')).toMatchObject({shouldSend:false});
});
it('combined content is dispatched once as marketing, without system prefixes',async()=>{
  mocks.invoke.mockResolvedValue({data:{ok:true,status:'sent'},error:null});
  expect(await sendSmsIfAllowed(customer,'combined','Ready! Also buy a case.')).toMatchObject({success:true});
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({message_type:'marketing',content:'Ready! Also buy a case.'});
});
it('a lost browser response keeps the send key for a retry after reloading',async()=>{
  mocks.invoke.mockResolvedValueOnce({error:{message:'network error'}}).mockResolvedValueOnce({data:{ok:true,status:'sent'}});
  const payload={customer_id:customer.id,message_type:'transactional' as const,content:'Ready.'};
  expect(await sendSmsViaEdgeFunction(payload)).toMatchObject({success:false,status:'uncertain'});
  const firstKey=mocks.invoke.mock.calls[0][1].body.idempotency_key;
  vi.resetModules();
  const reloaded=await import('../services/smsService');
  expect(await reloaded.sendSmsViaEdgeFunction(payload)).toMatchObject({success:true});
  expect(mocks.invoke.mock.calls[1][1].body.idempotency_key).toBe(firstKey);
});
it('an uncertain server result is never reported as success',async()=>{
  mocks.invoke.mockResolvedValue({data:{ok:false,status:'uncertain',reason:'Review Twilio'}});
  expect(await sendSmsViaEdgeFunction({customer_id:customer.id,message_type:'transactional',content:'Ready'})).toMatchObject({success:false,status:'uncertain'});
});
it('browser appointment processing delegates to the server instead of claiming or sending itself',async()=>{
  mocks.invoke.mockResolvedValue({data:{ok:true,processed:2,results:[]}});
  expect(await triggerAppointmentSmsProcessor()).toMatchObject({success:true,processed:2});
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('process-appointment-sms',{body:{}});
});
it.each(['STOP','stopall','unsubscribe','CANCEL','end','quit','revoke','optout'])('%s is a phone-level opt-out',body=>{
  expect(inboundOptOut(body)).toBe('STOP');
});
it('Twilio Advanced Opt-Out classification supports configured custom keywords',()=>{
  expect(inboundOptOut('Custom stop phrase','STOP')).toBe('STOP');
  expect(inboundOptOut('Custom subscribe phrase','START')).toBe('START');
  expect(inboundOptOut('YES')).toBeNull(); expect(inboundOptOut('NO')).toBeNull();
});
it('past appointment reminders and stale missed-appointment jobs expire',()=>{
  const now=new Date('2026-10-24T18:00:00Z');
  expect(appointmentSmsExpired('2026-09-17','reminder_2h','2026-09-17T11:00:00Z','America/Chicago',now)).toBe(true);
  expect(appointmentSmsExpired('2026-10-23','reminder_2h','2026-10-24T17:00:00Z','America/Chicago',now)).toBe(true);
  expect(appointmentSmsExpired('2026-10-24','reminder_2h','2026-10-24T17:00:00Z','America/Chicago',now)).toBe(false);
  expect(appointmentSmsExpired('2026-10-23','missed_appointment','2026-10-24T17:00:00Z','America/Chicago',now)).toBe(false);
});
it('legacy UI revocation metadata respects individual consent flags',()=>{
  const marketingOnly={...customer,marketing_sms_consent:false,revoked_at:new Date().toISOString(),revoked_reason:'User opted out via UI'};
  expect(evaluateSmsRouting(marketingOnly,'transactional','Ready')).toMatchObject({shouldSend:true});
  expect(evaluateSmsRouting(marketingOnly,'marketing','Promotion')).toMatchObject({shouldSend:false});
});
