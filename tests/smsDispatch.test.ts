import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { dispatchSms } from '../supabase/functions/_shared/smsDispatch';

let db: PGlite;
const customerId='00000000-0000-4000-8000-000000000001';
const campaignId='00000000-0000-4000-8000-000000000010';
const sid='SM00000000000000000000000000000001';
const env=(key: string) => ({ TWILIO_ACCOUNT_SID:'ACtest', TWILIO_AUTH_TOKEN:'test-token', TWILIO_FROM_NUMBER:'+18445551212' })[key];
const input={ customer_id:customerId, message_type:'transactional', content:'Your repair is ready.', idempotency_key:'test-send-1' };
const fixture=`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA crm_private;
CREATE TABLE public.customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,phone text,alt_phone text,created_at timestamptz DEFAULT now(),transactional_sms_consent boolean,marketing_sms_consent boolean,revoked_at timestamptz,revoked_reason text,
  consent_source text CHECK(consent_source IN ('iPad','web','POS','manual')),consent_method text CHECK(consent_method IN ('checkbox','keyword','verbal')),transactional_sms_consent_at timestamptz);
CREATE FUNCTION public.legacy_consent_timestamp() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.marketing_sms_consent=false AND OLD.marketing_sms_consent=true THEN
    NEW.revoked_at=now(); NEW.revoked_reason='User opted out via UI';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER legacy_consent_timestamp BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.legacy_consent_timestamp();
CREATE TABLE public.sms_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid REFERENCES public.customers(id),ticket_id uuid,campaign_id uuid,automation_id uuid,message_type text CHECK(message_type IN ('transactional','marketing')),content text NOT NULL,status text CHECK(status IN ('queued','sent','skipped','failed')),direction text,to_phone text,from_phone text,error_message text,provider_message_id text);
CREATE TABLE public.appointment_sms_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text DEFAULT 'pending',scheduled_for timestamptz,claimed_at timestamptz);
CREATE TABLE public.scheduled_campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text DEFAULT 'pending',scheduled_for timestamptz);
CREATE TABLE public.automations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text);
CREATE TABLE public.automation_enrollments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),automation_id uuid REFERENCES public.automations(id),contact_id uuid REFERENCES public.customers(id),status text DEFAULT 'active',processing_locked_at timestamptz,next_execution_at timestamptz);
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
`;
const argNames: Record<string,string[]>={
  crm_prepare_sms_dispatch:['p_key','p_fingerprint','p_customer_id','p_phone','p_type','p_content','p_ticket_id','p_campaign_id','p_automation_id'],
  crm_finish_sms_dispatch:['p_key','p_state','p_provider_id','p_reason'],
};
const client={ rpc: async (name: string,args: Record<string,unknown>) => {
  const keys=argNames[name];
  try {
    const { rows }=await db.query<{ result:any }>(`SELECT public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,keys.map(k=>args[k]));
    return { data:rows[0]?.result,error:null };
  } catch(error) { return {data:null,error}; }
} };
const goodFetch=()=>vi.fn().mockResolvedValue(Response.json({ sid }));
const send=(changes={}, fetcher=goodFetch(), target=client) => dispatchSms(target,{ ...input,...changes },{ env,fetch:fetcher });
const inbound=(body: string, action: string | null, providerId=sid,phone='+14095551212') => db.query<{ result:any }>(
  'SELECT public.crm_record_inbound_sms($1,$2,$3,$4,$5) AS result',[providerId,phone,'+18445551212',body,action]);

beforeAll(async()=>{
  db=new PGlite(); await db.exec(fixture);
  await db.exec(readFileSync('supabase/migrations/20261024181014_sms_dispatch_safety.sql','utf8'));
});
afterAll(async()=>{ await db?.close(); });
beforeEach(async()=>{
  await db.exec('TRUNCATE crm_private.sms_dispatch_receipts,crm_private.sms_phone_preferences,crm_private.sms_inbound_receipts,public.sms_messages,public.automation_enrollments,public.automations,public.customers,public.appointment_sms_jobs,public.scheduled_campaigns CASCADE');
  await db.query('INSERT INTO public.customers(id,name,phone,transactional_sms_consent,marketing_sms_consent) VALUES($1,$2,$3,true,true)',[customerId,'Test Customer','(409) 555-1212']);
});
it('parallel requests for the same send contact Twilio once and persist one message',async()=>{
  const fetcher=goodFetch(); const results=await Promise.all([send({},fetcher),send({},fetcher)]);
  expect(fetcher).toHaveBeenCalledTimes(1); expect(results.some(r=>r.ok)).toBe(true);
  expect((await db.query('SELECT * FROM public.sms_messages')).rows).toHaveLength(1);
  expect((await db.query('SELECT state FROM crm_private.sms_dispatch_receipts')).rows[0]).toMatchObject({state:'sent'});
});
it('a successful retry returns the stored provider ID without dispatch',async()=>{
  await send(); const fetcher=goodFetch(); const result=await send({},fetcher);
  expect(result).toMatchObject({ok:true,duplicate:true,message_id:sid}); expect(fetcher).not.toHaveBeenCalled();
});
it('a timeout remains uncertain across retries, with no second provider request',async()=>{
  const fetcher=vi.fn().mockRejectedValue(new Error('connection lost'));
  expect(await send({},fetcher)).toMatchObject({ok:false,status:'uncertain'});
  expect(await send({},fetcher)).toMatchObject({ok:false,status:'uncertain',duplicate:true});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT error_message FROM public.sms_messages')).rows[0].error_message).toContain('outcome unknown');
});
it('a failure recording the accepted provider outcome cannot trigger another send',async()=>{
  const fetcher=goodFetch(); const broken={rpc:async(name: string,args: any)=>name==='crm_finish_sms_dispatch'?{error:'database offline'}:client.rpc(name,args)};
  expect(await send({},fetcher,broken)).toMatchObject({status:'uncertain'});
  expect(await send({},fetcher)).toMatchObject({status:'uncertain',duplicate:true});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([500,502,503])('provider HTTP %s is ambiguous and cannot be retried automatically',async status=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({message:'server error'},{status}));
  expect(await send({},fetcher)).toMatchObject({status:'uncertain'});
  await send({},fetcher); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('a definitive provider rejection is recorded and not replayed with the same key',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({message:'rejected'},{status:400}));
  expect(await send({},fetcher)).toMatchObject({ok:false,status:'failed'});
  await send({},fetcher); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('changing a message under an existing key is rejected',async()=>{
  await send(); const fetcher=goodFetch();
  expect(await send({content:'Different message'},fetcher)).toMatchObject({ok:false,status:'conflict'});
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(['transactional','marketing'])('current %s consent is required at dispatch',async message_type=>{
  await db.exec(`UPDATE public.customers SET ${message_type}_sms_consent=false`);
  const fetcher=goodFetch(); expect(await send({message_type},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
it('raw phone numbers and unknown customer IDs cannot bypass consent',async()=>{
  await db.exec('UPDATE public.customers SET transactional_sms_consent=false');
  const fetcher=goodFetch();
  expect(await send({customer_id:null,to_phone:'1-409-555-1212'},fetcher)).toMatchObject({status:'skipped'});
  expect(await send({customer_id:'00000000-0000-4000-8000-000000000099',to_phone:'4095551212',idempotency_key:'unknown-customer'},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
it('an unknown phone is skipped until consent is recorded',async()=>{
  const fetcher=goodFetch(); expect(await send({customer_id:null,to_phone:'4095559999'},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
it('STOP blocks all formatting variants and duplicate contacts',async()=>{
  await db.query("INSERT INTO public.customers(phone,transactional_sms_consent,marketing_sms_consent) VALUES('14095551212',true,true)");
  await inbound('STOP','STOP');
  // Staff edits must not override phone-level STOP.
  await db.exec('UPDATE public.customers SET transactional_sms_consent=true,marketing_sms_consent=true,revoked_at=null');
  const fetcher=goodFetch(); expect(await send({},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
it('STOP from an unknown number still blocks a customer created later',async()=>{
  await inbound('STOP','STOP',sid,'+14095559999');
  await db.exec("INSERT INTO public.customers(phone,transactional_sms_consent,marketing_sms_consent) VALUES('4095559999',true,true)");
  const fetcher=goodFetch(); expect(await send({customer_id:null,to_phone:'4095559999'},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
it('START restores transactional consent without opting into marketing',async()=>{
  await inbound('STOP','STOP'); await inbound('START','START','SM00000000000000000000000000000002');
  expect(await send()).toMatchObject({ok:true,status:'sent'});
  const fetcher=goodFetch(); expect(await send({message_type:'marketing',idempotency_key:'marketing-after-start'},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
it('a repeated STOP callback is logged once and cannot undo a later START',async()=>{
  await inbound('STOP','STOP'); await inbound('START','START','SM00000000000000000000000000000002');
  expect((await inbound('STOP','STOP')).rows[0].result).toMatchObject({duplicate:true});
  expect((await db.query('SELECT blocked FROM crm_private.sms_phone_preferences')).rows[0]).toMatchObject({blocked:false});
  expect((await db.query("SELECT * FROM public.sms_messages WHERE direction='inbound'")).rows).toHaveLength(2);
});
it('alternate-number STOP suppresses the matching customer record',async()=>{
  await db.exec("UPDATE public.customers SET alt_phone='4095559999'");
  await inbound('STOP','STOP',sid,'+14095559999');
  const fetcher=goodFetch(); expect(await send({},fetcher)).toMatchObject({status:'skipped'}); expect(fetcher).not.toHaveBeenCalled();
});
it('campaign recipients deduplicate by normalized destination across duplicate contacts',async()=>{
  const dup=(await db.query<{id:string}>("INSERT INTO public.customers(phone,transactional_sms_consent,marketing_sms_consent) VALUES('14095551212',true,true) RETURNING id")).rows[0].id;
  const fetcher=goodFetch();
  await send({message_type:'marketing',campaign_id:campaignId},fetcher);
  expect(await send({customer_id:dup,message_type:'marketing',campaign_id:campaignId,idempotency_key:'duplicate-contact'},fetcher)).toMatchObject({status:'conflict'});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('appointment claims are exclusive and do not reclaim interrupted sends',async()=>{
  await db.exec("INSERT INTO public.appointment_sms_jobs(status,scheduled_for) VALUES('pending',now()-interval '1 minute'),('claimed',now()-interval '1 day'),('pending',now()+interval '1 day')");
  const claim=()=>db.query('SELECT * FROM public.crm_claim_appointment_sms(50)');
  const results=await Promise.all([claim(),claim()]); expect(results.flatMap(r=>r.rows)).toHaveLength(1);
});
it('campaign claims do not replay sending, completed or future campaigns',async()=>{
  await db.exec("INSERT INTO public.scheduled_campaigns(status,scheduled_for) VALUES('pending',now()-interval '1 minute'),('sending',now()-interval '1 day'),('completed',now()-interval '1 day'),('pending',now()+interval '1 day')");
  const claim=()=>db.query('SELECT * FROM public.crm_claim_scheduled_campaigns()');
  expect((await Promise.all([claim(),claim()])).flatMap(r=>r.rows)).toHaveLength(1);
});
it('automation claims respect both active statuses, due times and existing locks',async()=>{
  await db.exec(`INSERT INTO public.automations(id,status) VALUES('${campaignId}','active');
    INSERT INTO public.automation_enrollments(automation_id,contact_id,next_execution_at) VALUES('${campaignId}','${customerId}',now()-interval '1 minute');`);
  const claim=()=>db.query('SELECT * FROM public.crm_claim_automation_enrollments(10)');
  expect((await Promise.all([claim(),claim()])).flatMap(r=>r.rows)).toHaveLength(1);
});
it.each(['anon','authenticated'])('%s cannot dispatch, claim work, change phone blocks or read receipts',async role=>{
  await db.exec(`SET ROLE ${role}`);
  try {
    for (const query of ['SELECT * FROM crm_private.sms_phone_preferences','SELECT * FROM crm_private.sms_dispatch_receipts','SELECT public.crm_claim_appointment_sms(10)','SELECT public.crm_claim_scheduled_campaigns()',"SELECT public.crm_record_inbound_sms('x','x','x','STOP','STOP')"])
      await expect(db.exec(query)).rejects.toMatchObject({code:'42501'});
  } finally { await db.exec('RESET ROLE'); }
});
it('service-role RPCs work without security-definer escalation',async()=>{
  await db.exec('SET ROLE service_role');
  try { expect(await send()).toMatchObject({ok:true}); } finally { await db.exec('RESET ROLE'); }
});
it('a legacy UI marketing opt-out does not block permitted transactional updates',async()=>{
  await db.exec('UPDATE public.customers SET marketing_sms_consent=false');
  expect((await db.query('SELECT revoked_reason FROM public.customers')).rows[0]).toMatchObject({revoked_reason:'User opted out via UI'});
  expect(await send()).toMatchObject({ok:true,status:'sent'});
  const fetcher=goodFetch(); expect(await send({message_type:'marketing',idempotency_key:'ui-marketing-optout'},fetcher)).toMatchObject({status:'skipped'});
  expect(fetcher).not.toHaveBeenCalled();
});
