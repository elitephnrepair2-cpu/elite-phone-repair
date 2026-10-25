import React,{useState} from 'react';
import {getKioskPair,pairKiosk,startKiosk,forgetKiosk} from '../services/kioskDeviceService';
export default function KioskSetupDialog({location,onClose}:{location:string;onClose:()=>void}){
 const [pair]=useState(()=>getKioskPair(location));
 const [pin,setPin]=useState('');const [confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 return <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="kiosk-setup-title">
  <form className="max-w-md w-full bg-white rounded-3xl p-6 space-y-4 text-slate-900" autoComplete="off" onSubmit={async e=>{
   e.preventDefault();if(busy)return;setError('');
   if(!pair && (!/^\d{6}$/.test(pin)||pin!==confirm)){setError('Enter matching six-digit PINs.');return;}
   setBusy(true);try{const configured=pair || await pairKiosk(location,pin);setPin('');setConfirm('');await startKiosk(configured);}catch(e){setError(e instanceof Error?e.message:'Could not start check-in.');setBusy(false);}
  }}>
   <h2 id="kiosk-setup-title" className="text-2xl font-bold">Customer check-in · {location}</h2>
   <p>Staff information will be locked before you hand the iPad to a customer.</p>
   {!pair && <>
    <p className="text-sm text-slate-600">Pair this iPad for 30 days. Choose a private six-digit PIN to return to your dashboard. Your staff password remains available if you forget it.</p>
    <label className="block">Create return PIN<input aria-label="Create return PIN" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value)} autoComplete="new-password" className="block w-full rounded-xl border p-3 mt-1" required/></label>
    <label className="block">Confirm PIN<input aria-label="Confirm PIN" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" className="block w-full rounded-xl border p-3 mt-1" required/></label>
   </>}
   {pair && <p className="text-sm text-slate-600">This iPad is paired for {pair.location}. Return to the dashboard with your device PIN.</p>}
   {error && <p role="alert" className="text-red-700">{error}</p>}
   <button disabled={busy} className="w-full bg-red-600 text-white rounded-xl p-3 font-bold disabled:opacity-50">{busy?'Locking staff access…':pair?'Start customer check-in':'Pair this iPad & start check-in'}</button>
   <button type="button" disabled={busy} onClick={onClose} className="w-full p-2">Cancel</button>
   {pair && <button type="button" disabled={busy} className="text-sm underline text-slate-600" onClick={async()=>{setBusy(true);try{await forgetKiosk(pair);}catch{setError('Could not remove pairing. Please try again.');setBusy(false);}}}>Remove pairing and sign out</button>}
  </form>
 </div>;
}
