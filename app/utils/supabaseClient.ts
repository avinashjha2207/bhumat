import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseUrl = (rawUrl && rawUrl.startsWith('http')) 
  ? rawUrl 
  : 'https://exzvzwlqbygftclsyecq.supabase.co';

const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseAnonKey = (rawKey && rawKey.length > 20)
  ? rawKey
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4enZ6d2xxYnlnZnRjbHN5ZWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjY4NzEsImV4cCI6MjEwNzc0Mjg3MX0.sV4uM432y-v-L7_D822zQYf5w588b_H7c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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