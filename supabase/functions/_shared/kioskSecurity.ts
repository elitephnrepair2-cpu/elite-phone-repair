export function tokenSessionId(token:string):string|null {
  try {
    const value=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;
    return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:null;
  } catch { return null; }
}
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
export async function hashDeviceSecret(secret:string) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid device');
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
}
export async function hashKioskPin(pin:string,salt:string) {
  if (!/^\d{6}$/.test(pin) || !/^[a-f0-9]{32}$/.test(salt)) throw new Error('Invalid PIN');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:600000,hash:'SHA-256'},key,256));
}
export function equalHash(a:string,b:string) {
  if(a.length!==b.length)return false;
  let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);
  return different===0;
}
export function randomHex(bytes:number) { return hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer); }
