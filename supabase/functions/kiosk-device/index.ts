import {serve,createClient} from '../_shared/runtime.ts';
import {verifiedStaffIdentity} from '../_shared/authorization.ts';
import {parseCheckIn,readLimitedBody} from '../_shared/checkIn.ts';
import {equalHash,hashDeviceSecret,hashKioskPin,randomHex,tokenSessionId} from '../_shared/kioskSecurity.ts';

export async function handleKioskDevice(req:Request) {
 const origin=req.headers.get('Origin') || '';
 const origins=(Deno.env.get('KIOSK_ORIGINS') || 'https://elite-phone-repair.vercel.app').split(',').map(s=>s.trim());
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(status:number,value:Record<string,unknown>)=>new Response(JSON.stringify(value),{status,headers});
 if(!origins.includes(origin))return reply(403,{ok:false});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{ok:false});
 try {
  const input=await readLimitedBody(req);
  const action=input?.action;
  if(!['register','start','submit','unlock','revoke'].includes(action))return reply(400,{ok:false});
  const url=Deno.env.get('SUPABASE_URL') || '';
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',{auth:{persistSession:false,autoRefreshToken:false}});
  const device=action==='register'?crypto.randomUUID():input.deviceId;
  if(typeof device!=='string' || !/^[0-9a-f-]{36}$/i.test(device))return reply(400,{ok:false});
  const secret=action==='register'?randomHex(32):input.deviceSecret;
  const secretHash=await hashDeviceSecret(secret);
  const args:any={p_action:action,p_device:device,p_secret_hash:secretHash};
  if(action==='start'){
   const token=(req.headers.get('Authorization') || '').replace(/^Bearer /,'');
   const {data:{user},error}=await service.auth.getUser(token);const session=tokenSessionId(token);
   if(error || !user || !session)return reply(403,{ok:false});
   args.p_user=user.id;args.p_session=session;
  }
  if(['register','revoke'].includes(action)) {
   const identity=await verifiedStaffIdentity(req,service);
   if(!identity || (action==='register' && identity.role!=='admin'))return reply(403,{ok:false});
   args.p_user=identity.user.id;args.p_session=identity.sessionId;
  }
  if(action==='register') {
   if(!['Houston','Beaumont'].includes(input.location) || typeof input.pin!=='string' || !/^\d{6}$/.test(input.pin))return reply(400,{ok:false});
   args.p_location=input.location;args.p_salt=randomHex(16);args.p_pin_hash=await hashKioskPin(input.pin,args.p_salt);
  }
  const {data:deviceState,error}=await service.rpc('crm_kiosk_device',args);
  if(error)throw error;
  if(!deviceState)return reply(403,{ok:false});
  if(deviceState.limited)return reply(429,{ok:false,error:'Please wait 15 minutes or use your staff password.'});
  if(action==='register')return reply(200,{ok:true,deviceId:device,deviceSecret:secret,location:deviceState.location,expiresAt:deviceState.expires_at});
  if(action==='start' || action==='revoke')return reply(200,{ok:true,location:deviceState.location});
  if(action==='submit') {
   // The registered location is authoritative. No IDs, prices or matching results
   // are accepted from or returned to the customer-facing device.
   const checkIn=parseCheckIn({...input.checkIn,location:deviceState.location,verificationToken:'paired-kiosk'});
   const {error:saveError}=await service.rpc('crm_submit_check_in',{request_id:checkIn.requestId,payload:checkIn.payload});
   if(saveError)return reply(saveError.code==='P0001'?429:503,{ok:false});
   return reply(200,{ok:true});
  }
  // The attempt has already been reserved atomically, before expensive PIN work.
  if(typeof input.pin!=='string' || !/^\d{6}$/.test(input.pin))return reply(403,{ok:false});
  if(!equalHash(await hashKioskPin(input.pin,deviceState.pin_salt),deviceState.pin_hash))return reply(403,{ok:false});
  const {data:owner,error:ownerError}=await service.auth.admin.getUserById(deviceState.owner_id);
  if(ownerError || !owner.user?.email_confirmed_at || !owner.user.email)return reply(403,{ok:false});
  const {data:link,error:linkError}=await service.auth.admin.generateLink({type:'magiclink',email:owner.user.email});
  if(linkError || link.user?.id!==deviceState.owner_id || !link.properties?.hashed_token)throw new Error('Unlock unavailable');
  // Separate Auth client: verifying an OTP must never replace the service client's
  // authorization header. No email is sent and no link/token is put in the URL.
  const authClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:login,error:loginError}=await authClient.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'email'});
  const session=login.session;const sessionId=session && tokenSessionId(session.access_token);
  if(loginError || login.user?.id!==deviceState.owner_id || !sessionId)throw new Error('Unlock unavailable');
  const {data:bound,error:bindError}=await service.rpc('crm_kiosk_device',{
   p_action:'bind_unlock',p_device:device,p_secret_hash:secretHash,p_user:deviceState.owner_id,p_session:sessionId});
  if(bindError || !bound)throw new Error('Unlock unavailable');
  return reply(200,{ok:true,session:{access_token:session.access_token,refresh_token:session.refresh_token}});
 } catch { return reply(503,{ok:false,error:'Unable to complete this kiosk request. Please ask staff for help.'}); }
}
serve(handleKioskDevice);
