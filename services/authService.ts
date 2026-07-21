import { supabase } from '../supabaseClient';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
}

const STAFF_PIN_KEY = 'elite_staff_pins';

// Default staff PINs if not yet custom-configured in Shop Settings
const DEFAULT_STAFF_PINS: Record<string, { name: string; role: 'admin' | 'staff' }> = {
  '1234': { name: 'Front Desk Staff', role: 'staff' },
  '7777': { name: 'Store Manager', role: 'admin' },
};

/**
 * Gets saved PIN mappings from local storage or defaults
 */
export const getStaffPins = (): Record<string, { name: string; role: 'admin' | 'staff' }> => {
  try {
    const saved = localStorage.getItem(STAFF_PIN_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading staff PINs:", e);
  }
  return DEFAULT_STAFF_PINS;
};

/**
 * Saves updated staff PIN mappings
 */
export const saveStaffPins = (pins: Record<string, { name: string; role: 'admin' | 'staff' }>) => {
  localStorage.setItem(STAFF_PIN_KEY, JSON.stringify(pins));
};

/**
 * Authenticate staff using a 4-digit PIN
 */
export const authenticateWithPin = (pin: string): StaffUser | null => {
  const pins = getStaffPins();
  const match = pins[pin.trim()];
  if (match) {
    return {
      id: `pin_${pin.trim()}`,
      email: `${match.name.toLowerCase().replace(/\s+/g, '')}@elitephonerepair.com`,
      name: match.name,
      role: match.role
    };
  }
  return null;
};

/**
 * Sign in via Supabase Auth email & password
 */
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password.trim()
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const user = data.user;
  const staffUser: StaffUser = {
    id: user.id,
    email: user.email || email,
    name: user.user_metadata?.full_name || email.split('@')[0],
    role: (user.user_metadata?.role as 'admin' | 'staff') || 'admin'
  };

  return { success: true, user: staffUser };
};

/**
 * Sign out current staff session
 */
export const signOutStaff = async () => {
  await supabase.auth.signOut();
  localStorage.removeItem('elite_active_staff');
};
