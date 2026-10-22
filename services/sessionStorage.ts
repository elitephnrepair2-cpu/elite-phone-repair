const TRUSTED_DEVICE_KEY = 'elite_trusted_device';

export function isTrustedDevice() {
  try { return localStorage.getItem(TRUSTED_DEVICE_KEY) === 'true'; }
  catch { return false; }
}

export function setTrustedDevice(trusted: boolean) {
  if (trusted) localStorage.setItem(TRUSTED_DEVICE_KEY, 'true');
  else localStorage.removeItem(TRUSTED_DEVICE_KEY);
}

// Both stores survive refresh. Only explicit trusted-device sessions are kept
// in persistent storage; normal sessions stay scoped to the current tab.
export const staffSessionStorage = {
  getItem(key: string) {
    if (isTrustedDevice()) return localStorage.getItem(key);
    localStorage.removeItem(key); // Do not inherit a legacy persistent login.
    return sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    const trusted = isTrustedDevice();
    (trusted ? localStorage : sessionStorage).setItem(key, value);
    (trusted ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
