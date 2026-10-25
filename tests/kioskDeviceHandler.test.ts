import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({createClient:vi.fn(),serve:vi.fn(),rpc:vi.fn(),getUser:vi.fn(),getUserById:vi.fn(),generateLink:vi.fn(),verifyOtp:vi.fn()}));
vi.mock('../supabase/functions/_shared/runtime.ts',()=>mocks);
import {handleKioskDevice} from '../supabase/functions/kiosk-device';
import {hashKioskPin} from '../supabase/functions/_shared/kioskSecurity';
const owner='00000000-0000-4000-8000-000000000001';
const session='00000000-0000-4000-8000-000000000011';
const jwt='header.'+btoa(JSON.stringify({session_id:session}))+'.signature';
const request=(body:any)=>new Request('https://example.test/functions/v1/kiosk-device',{method:'POST',headers:{Origin:'https://elite-phone-repair.vercel.app',Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({deviceId:'00000000-0000-4000-8000-000000000020',deviceSecret:'a'.repeat(64),...body})});
let pinHash:string;
beforeEach(async()=>{
 vi.clearAllMocks();vi.stubGlobal('Deno',{env:{get:(key:string)=>({SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-key',SUPABASE_ANON_KEY:'public-key'})[key]}});
 pinHash=await hashKioskPin('938271','c'.repeat(32));
 const service={rpc:mocks.rpc,auth:{getUser:mocks.getUser,admin:{getUserById:mocks.getUserById,generateLink:mocks.generateLink}}};
 const auth={auth:{verifyOtp:mocks.verifyOtp}};
 mocks.createClient.mockImplementation((_url:string,key:string)=>key==='server-key'?service:auth);
 mocks.getUser.mockResolvedValue({data:{user:{id:owner}},error:null});
 mocks.rpc.mockImplementation(async(name:string,args:any)=>name==='crm_authorize_staff_session'?{data:'admin'}:args.p_action==='unlock'?{data:{owner_id:owner,pin_salt:'c'.repeat(32),pin_hash:pinHash}}:{data:{owner_id:owner,location:'Houston',expires_at:'2026-11-25T00:00:00Z'}});
 mocks.getUserById.mockResolvedValue({data:{user:{id:owner,email:'owner@example.test',email_confirmed_at:'2026-01-01'}}});
 mocks.generateLink.mockResolvedValue({data:{user:{id:owner},properties:{hashed_token:'one-time-token'}}});
 mocks.verifyOtp.mockResolvedValue({data:{user:{id:owner},session:{access_token:jwt,refresh_token:'new-refresh'}}});
});
it('a wrong PIN cannot generate login links or mint a staff session',async()=>{
 const response=await handleKioskDevice(request({action:'unlock',pin:'111111'}));expect(response.status).toBe(403);
 expect(mocks.generateLink).not.toHaveBeenCalled();expect(mocks.verifyOtp).not.toHaveBeenCalled();
});
it('only correct PINs unlock the bound owner and return a fresh session without an email/link',async()=>{
 const response=await handleKioskDevice(request({action:'unlock',pin:'938271'}));expect(response.status).toBe(200);
 expect(await response.json()).toEqual({ok:true,session:{access_token:jwt,refresh_token:'new-refresh'}});
 expect(mocks.rpc).toHaveBeenLastCalledWith('crm_kiosk_device',expect.objectContaining({p_action:'bind_unlock',p_user:owner,p_session:session}));
 expect(mocks.createClient.mock.calls[1][1]).toBe('public-key');
});
it('device rate limits reject before PIN hashing or any authentication request',async()=>{
 mocks.rpc.mockResolvedValue({data:{limited:true}});
 const response=await handleKioskDevice(request({action:'unlock',pin:'938271'}));expect(response.status).toBe(429);expect(mocks.generateLink).not.toHaveBeenCalled();
});
it('an inactive or revoked device never invokes Auth',async()=>{
 mocks.rpc.mockResolvedValue({data:null});expect((await handleKioskDevice(request({action:'unlock',pin:'938271'}))).status).toBe(403);
 expect(mocks.getUserById).not.toHaveBeenCalled();
});
it('registration accepts only verified admins',async()=>{
 mocks.rpc.mockResolvedValue({data:'staff'});
 expect((await handleKioskDevice(request({action:'register',location:'Houston',pin:'938271'}))).status).toBe(403);
});
it('public kiosk submission cannot choose another store, set a price or obtain customer IDs',async()=>{
 const checkIn={requestId:crypto.randomUUID(),name:'Demo',phone:'4095551212',email:'',callBackNumber:'',device:'iPhone 12',deviceBrand:'Apple',deviceModel:'iPhone 12',repairCategory:'Screen',problemDescription:'Broken',heardFrom:'Other',transactionalConsent:true,promotionalConsent:false,location:'Beaumont',customer_id:'victim',price:0};
 const response=await handleKioskDevice(request({action:'submit',checkIn}));expect(await response.json()).toEqual({ok:true});
 const call=mocks.rpc.mock.calls.find(([name])=>name==='crm_submit_check_in');
 expect(call![1].payload.location).toBe('Houston');expect(call![1].payload).not.toHaveProperty('customer_id');expect(call![1].payload).not.toHaveProperty('price');
});
it('untrusted origins cannot probe device or PIN records',async()=>{
 const req=new Request('https://example.test',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'});
 expect((await handleKioskDevice(req)).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
});
