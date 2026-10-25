import React,{useRef,useState} from 'react';
import KioskView from './KioskView';
import {StaffLoginView} from './StaffLoginView';
import {finishStaffReturn,getKioskPair,submitKiosk,unlockKiosk} from '../services/kioskDeviceService';
export default function PairedKiosk({location}:{location:string}){
 const [pair]=useState(()=>getKioskPair(location));const requestId=useRef(crypto.randomUUID());
 const [returning,setReturning]=useState(false);const [usePassword,setUsePassword]=useState(false);
 const [pin,setPin]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 if(returning && usePassword)return <div><StaffLoginView businessName="Return to staff dashboard" onSignedIn={finishStaffReturn}/><button className="fixed top-4 left-4 text-white underline" onClick={()=>{setUsePassword(false);setError('');}}>Back to check-in</button></div>;
 return <main className="min-h-screen bg-slate-900 p-4 sm:p-8">
  <p className="text-center text-white mb-4">Customer check-in · {location}</p>
  <KioskView canSubmit={Boolean(pair)} onExitKiosk={()=>{setReturning(true);setError('');}}
   verification={<>{!pair && <p role="alert" className="text-red-700">This iPad needs staff setup before accepting check-ins.</p>}{error && <p role="alert" className="text-red-700">{error}</p>}</>}
   onCheckIn={async data=>{
    if(!pair)return false;try{await submitKiosk(pair,{...data,requestId:requestId.current});requestId.current=crypto.randomUUID();setError('');return true;}
    catch{setError('Check-in could not be saved. Please return the iPad to staff.');return false;}
   }}/>
  {returning && <div className="fixed inset-0 z-50 bg-slate-950/90 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="staff-return-title">
   <form autoComplete="off" className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4" onSubmit={async e=>{e.preventDefault();if(busy||!pair)return;setBusy(true);setError('');try{await unlockKiosk(pair,pin);}catch(e){setPin('');setError(e instanceof Error?e.message:'Could not unlock.');setBusy(false);}}}>
    <h2 id="staff-return-title" className="text-2xl font-bold">Return to staff dashboard</h2>
    <label className="block">Return PIN<input aria-label="Return PIN" type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="off" className="w-full block rounded-xl border p-3 mt-1" value={pin} onChange={e=>setPin(e.target.value)} required disabled={busy}/></label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy||!pair} className="w-full bg-red-600 text-white rounded-xl p-3 font-bold disabled:opacity-50">{busy?'Checking PIN…':'Unlock dashboard'}</button>
    <button type="button" disabled={busy} className="block underline text-sm" onClick={()=>{setPin('');setError('');setUsePassword(true);}}>Use staff password instead</button>
    <button type="button" disabled={busy} className="block text-sm" onClick={()=>{setReturning(false);setPin('');setError('');}}>Back to customer check-in</button>
   </form>
  </div>}
 </main>;
}
