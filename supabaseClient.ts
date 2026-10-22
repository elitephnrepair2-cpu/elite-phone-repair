import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { staffSessionStorage } from './services/sessionStorage';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://tbcvbxvqicowjtbggkfa.supabase.co";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiY3ZieHZxaWNvd2p0Ymdna2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTY0MjYsImV4cCI6MjA3NDQ5MjQyNn0.IVT3hOlS12XePDC-hFQIoR79FXdyNxHivpR--Gro8GA";

export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: staffSessionStorage, storageKey: AUTH_STORAGE_KEY },
});
