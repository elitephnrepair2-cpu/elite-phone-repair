import { supabase, AUTH_STORAGE_KEY } from '../supabaseClient';
import { setTrustedDevice, staffSessionStorage } from './sessionStorage';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
}

// Membership is provisioned by an administrator, never from user metadata or PINs.
export async function getVerifiedStaff(): Promise<StaffUser | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: member, error: membershipError } = await supabase
    .from('staff_members').select('user_id, name, role, active')
    .eq('user_id', user.id).eq('active', true).maybeSingle();
  if (membershipError || !member || !member.active || !['admin', 'staff'].includes(member.role)) return null;
  return { id: user.id, email: user.email || '', name: member.name, role: member.role };
}

export async function signInWithEmail(email: string, password: string, trustedDevice = false) {
  setTrustedDevice(trustedDevice);
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return { success: !error, error: error ? 'Unable to sign in. Check your email and password.' : undefined };
}

export async function signOutStaff() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    // Local locking must work even when the auth server cannot be reached.
    staffSessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('elite_active_staff');
    localStorage.removeItem('elite_staff_pins');
  }
}
