import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lleeljlvqltfzlidmsqs.supabase.co';
const supabaseUrl = rawUrl.replace(/[()]/g, '').trim();
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWVsamx2cWx0ZnpsaWRtc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODE3NTUsImV4cCI6MjEwNjk1Nzc1NX0.sQdPyFJpjKrt8mZx_xpOh8lgYPxCGrsO7IgDmxiwJfc';

export const supabase = createClient(supabaseUrl, rawKey.trim());

// Safe in-memory fallback for iOS Safari Private Browsing
const memoryStore = new Map<string, string>();

const memoryFallback: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const val = window.localStorage.getItem(key);
      return val !== null ? val : (memoryFallback[key] || null);
    } catch (e) {
      return memoryFallback[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // In-memory fallback if incognito blocks localStorage
    }
    memoryFallback[key] = value;
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
    delete memoryFallback[key];
  }
};