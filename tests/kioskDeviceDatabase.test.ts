import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,expect,it} from 'vitest';
let db:PGlite;
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const oldSession='00000000-0000-4000-8000-000000000010',newSession='00000000-0000-4000-8000-000000000011';
const device='00000000-0000-4000-8000-000000000020',secret='a'.repeat(64),pinHash='b'.repeat(64),salt='c'.repeat(32);
const fixture=`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;CREATE SCHEMA crm_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
GRANT USAGE ON SCHEMA public,auth,crm_private TO authenticated,service_role;
CREATE TABLE public.staff_members(user_id uuid PRIMARY KEY,name text,role text,active boolean);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_membership_read ON public.staff_members FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.staff_members TO authenticated;GRANT ALL ON public.staff_members TO service_role;
CREATE TABLE public.customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,phone text,email text,alt_phone text,location text,created_at timestamptz DEFAULT now(),transactional_sms_consent boolean,marketing_sms_consent boolean,transactional_sms_consent_at timestamptz,marketing_sms_consent_at timestamptz,consent_source text CHECK(consent_source IN ('iPad','web','manual','POS')),consent_method text,consent_form_version text);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.customers TO authenticated,service_role;
CREATE FUNCTION crm_private.crm_is_staff() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
CREATE POLICY crm_staff_access ON public.customers FOR ALL TO authenticated USING(crm_private.crm_is_staff()) WITH CHECK(crm_private.crm_is_staff());
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid,device text,problem_description text,heard_from text,location text,repair_type text,estimated_cost text);
CREATE TABLE public.repair_prices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),brand text,model text,category text,price text);
CREATE TABLE crm_private.intake_receipts(request_id uuid PRIMARY KEY,phone text,created_at timestamptz);
GRANT ALL ON public.tickets,public.repair_prices,crm_private.intake_receipts TO service_role;
`;
async function rpc(action:string,options:any={}){
 const {rows}=await db.query<{value:any}>('SELECT public.crm_kiosk_device($1,$2,$3,$4,$5,$6,$7,$8) value',
 [action,options.device||device,options.secret||secret,options.user??owner,options.session??oldSession,options.location??'Houston',options.pinHash??pinHash,options.salt??salt]);
 return rows[0].value;
}
async function asUser(session:string,run:()=>Promise<any>){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[owner,JSON.stringify({session_id:session})]);
 await db.exec('SET ROLE authenticated');try{return await run();}finally{await db.exec('RESET ROLE');}
}
beforeAll(async()=>{db=new PGlite();await db.exec(fixture);await db.exec(readFileSync('supabase/migrations/20261025220703_paired_kiosk_handoff.sql','utf8'));});
afterAll(async()=>{await db?.close();});
beforeEach(async()=>{
 await db.exec('TRUNCATE crm_private.kiosk_unlock_sessions,crm_private.kiosk_session_locks,crm_private.kiosk_devices,public.staff_members,public.customers,public.tickets,crm_private.intake_receipts CASCADE');
 await db.query("INSERT INTO public.staff_members VALUES($1,'Owner','admin',true),($2,'Staff','staff',true)",[owner,other]);
 await db.exec("INSERT INTO public.customers(name,phone,location,transactional_sms_consent,marketing_sms_consent) VALUES('Existing','(409) 555-1212','Houston',false,false)");
 await rpc('register');
});
it('suspends the handed-off JWT at RLS and Edge checks while a new password session remains valid',async()=>{
 expect((await asUser(oldSession,()=>db.query('SELECT * FROM public.customers'))).rows).toHaveLength(1);
 await rpc('start');
 expect((await asUser(oldSession,()=>db.query('SELECT * FROM public.customers'))).rows).toHaveLength(0);
 expect((await asUser(oldSession,()=>db.query('SELECT * FROM public.staff_members'))).rows).toHaveLength(0);
 expect((await asUser(newSession,()=>db.query('SELECT * FROM public.customers'))).rows).toHaveLength(1);
 const {rows}=await db.query('SELECT public.crm_authorize_staff_session($1,$2) role',[owner,oldSession]);expect(rows[0].role).toBeNull();
});
it('start is idempotent for an already suspended session and cannot lock another owner',async()=>{
 expect(await rpc('start')).toMatchObject({location:'Houston'});expect(await rpc('start')).toMatchObject({location:'Houston'});
 expect(await rpc('start',{user:other,session:newSession})).toBeNull();
});
it('missing claims cannot inherit active staff membership',async()=>{
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)",[owner]);
 await db.exec('SET ROLE authenticated');try{expect((await db.query('SELECT * FROM public.customers')).rows).toHaveLength(0);}finally{await db.exec('RESET ROLE');}
});
it('only active admins can register a device and its location is fixed',async()=>{
 expect(await rpc('register',{device:crypto.randomUUID(),user:other})).toBeNull();
 expect(await rpc('submit')).toMatchObject({location:'Houston'});
 expect(await rpc('submit',{secret:'f'.repeat(64)})).toBeNull();
});
it('five PIN attempts block further attempts and the window expires without bypassing the PIN',async()=>{
 for(let i=0;i<5;i++)expect(await rpc('unlock')).toHaveProperty('pin_hash');
 expect(await rpc('unlock')).toEqual({limited:true});
 await db.exec("UPDATE crm_private.kiosk_devices SET blocked_until=now()-interval '1 second',pin_window=now()-interval '16 minutes'");
 expect(await rpc('unlock')).toHaveProperty('pin_hash');
});
it('successful PIN sessions are bound to the device and stop working when it is revoked',async()=>{
 await rpc('bind_unlock',{session:newSession});expect((await asUser(newSession,()=>db.query('SELECT * FROM public.customers'))).rows).toHaveLength(1);
 await rpc('revoke');expect((await asUser(newSession,()=>db.query('SELECT * FROM public.customers'))).rows).toHaveLength(0);
 expect(await rpc('submit')).toBeNull();expect(await rpc('unlock')).toBeNull();
});
it('expired devices and inactive owners cannot submit or unlock',async()=>{
 await db.exec("UPDATE crm_private.kiosk_devices SET expires_at=now()-interval '1 second'");expect(await rpc('unlock')).toBeNull();
 await db.exec("UPDATE crm_private.kiosk_devices SET expires_at=now()+interval '1 day';UPDATE public.staff_members SET active=false");expect(await rpc('submit')).toBeNull();
});
it('bounds device submissions independently of the global intake limit',async()=>{
 for(let i=0;i<60;i++)expect(await rpc('submit')).toHaveProperty('location');expect(await rpc('submit')).toEqual({limited:true});
});
it.each(['anon','authenticated'])('%s cannot read device secrets or call service-only pairing/unlock methods',async role=>{
 await db.exec(`SET ROLE ${role}`);try{
  await expect(db.exec('SELECT * FROM crm_private.kiosk_devices')).rejects.toMatchObject({code:'42501'});
  await expect(rpc('unlock')).rejects.toMatchObject({code:'42501'});
 }finally{await db.exec('RESET ROLE');}
});
it('check-in uses an allowed consent source, creates one ticket, and cannot rewrite existing revoked consent',async()=>{
 const payload={name:'Attacker rename',phone:'4095551212',email:'',callBackNumber:'',location:'Houston',device:'iPhone 12',deviceBrand:'Apple',deviceModel:'iPhone 12',repairCategory:'Screen',problemDescription:'Broken screen',heardFrom:'Other',transactionalConsent:true,promotionalConsent:true};
 const id=crypto.randomUUID();
 await db.query('SELECT crm_private.crm_submit_check_in($1,$2)',[id,JSON.stringify(payload)]);
 await db.query('SELECT crm_private.crm_submit_check_in($1,$2)',[id,JSON.stringify(payload)]);
 expect((await db.query('SELECT * FROM public.tickets')).rows).toHaveLength(1);
 expect((await db.query('SELECT name,marketing_sms_consent FROM public.customers')).rows[0]).toEqual({name:'Existing',marketing_sms_consent:false});
 await db.query('SELECT crm_private.crm_submit_check_in($1,$2)',[crypto.randomUUID(),JSON.stringify({...payload,phone:'4095559999'})]);
 expect((await db.query("SELECT consent_source FROM public.customers WHERE phone='(409) 555-9999'")).rows[0]).toEqual({consent_source:'iPad'});
});
