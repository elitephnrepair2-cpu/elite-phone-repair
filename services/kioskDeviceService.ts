import {createClient} from '@supabase/supabase-js';
import {supabase,SUPABASE_URL,SUPABASE_ANON_KEY} from '../supabaseClient';
import {getVerifiedStaff,signOutStaff} from './authService';
const PAIRS='elite_kiosk_devices_v1';
const LOCK='elite_kiosk_handoff_v1';
export const KIOSK_LOCK_EVENT='elite-kiosk-handoff';
export type KioskPair={deviceId:string;deviceSecret:string;location:string;expiresAt:string};
const publicClient=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
export function getKioskPair(location:string):KioskPair|null {
 try {const p=JSON.parse(localStorage.getItem(PAIRS)||'{}')[location];return p?.deviceId && p?.deviceSecret?p:null;}catch{return null;}
}
export function isKioskLocked(){try{return Boolean(localStorage.getItem(LOCK));}catch{return true;}}
export function lockedKioskLocation(){const value=localStorage.getItem(LOCK);return value==='Houston'?'Houston':value==='Beaumont'?'Beaumont':null;}
function setLock(locked:boolean,location?:string){if(locked)localStorage.setItem(LOCK,location || 'Houston');else localStorage.removeItem(LOCK);window.dispatchEvent(new Event(KIOSK_LOCK_EVENT));}
async function call(client:any,body:any){
 const {data,error}=await client.functions.invoke('kiosk-device',{body});
 if(error || !data?.ok)throw new Error(data?.error || 'Unable to complete this request. Please try again or use your staff password.');
 return data;
}
export async function pairKiosk(location:string,pin:string){
 const result=await call(supabase,{action:'register',location,pin});
 const pair:KioskPair={deviceId:result.deviceId,deviceSecret:result.deviceSecret,location:result.location,expiresAt:result.expiresAt};
 const pairs=JSON.parse(localStorage.getItem(PAIRS)||'{}');pairs[location]=pair;localStorage.setItem(PAIRS,JSON.stringify(pairs));return pair;
}
export async function startKiosk(pair:KioskPair){
 await call(supabase,{action:'start',deviceId:pair.deviceId,deviceSecret:pair.deviceSecret});
 // Mask every staff view immediately. The server has already suspended this JWT
 // session, including any other tab holding a copy of the old access token.
 setLock(true,pair.location);
 try{await signOutStaff();}catch{/* Local credentials are cleared even offline. */}
 window.location.replace(`/?view=kiosk&location=${encodeURIComponent(pair.location)}`);
}
export async function submitKiosk(pair:KioskPair,checkIn:any){return call(publicClient,{action:'submit',deviceId:pair.deviceId,deviceSecret:pair.deviceSecret,checkIn});}
export async function unlockKiosk(pair:KioskPair,pin:string){
 const result=await call(publicClient,{action:'unlock',deviceId:pair.deviceId,deviceSecret:pair.deviceSecret,pin});
 const {error}=await supabase.auth.setSession(result.session);if(error)throw new Error('Could not restore staff session. Use your staff password.');
 await finishStaffReturn();
}
export async function finishStaffReturn(){
 if(!await getVerifiedStaff()){await signOutStaff();throw new Error('Staff access is required.');}
 setLock(false);window.location.replace('/');
}
export async function forgetKiosk(pair:KioskPair){
 try{await call(supabase,{action:'revoke',deviceId:pair.deviceId,deviceSecret:pair.deviceSecret});}catch{/* Expired pairings can still be removed locally. */}
 const pairs=JSON.parse(localStorage.getItem(PAIRS)||'{}');delete pairs[pair.location];localStorage.setItem(PAIRS,JSON.stringify(pairs));
 await signOutStaff();window.location.replace('/');
}
