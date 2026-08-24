import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read Supabase credentials from environment variables safely
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {}) as any;

const supabaseUrl =
  env.VITE_SUPABASE_URL || 'https://moubboivhveqdqrwmlkq.supabase.co';

const supabasePublishableKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    supabasePublishableKey.trim() !== '' &&
    !supabasePublishableKey.startsWith('MY_')
);

// Fallback dummy client if key is not configured, to prevent startup crashes
const fallbackDummyClient = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: new Error('Supabase Publishable Key not configured') }),
    insert: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
    update: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
    upsert: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
    delete: () => Promise.resolve({ data: null, error: new Error('Supabase Publishable Key not configured') }),
  }),
  channel: () => ({
    on: () => ({
      subscribe: () => ({}),
    }),
  }),
} as unknown as SupabaseClient;

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : fallbackDummyClient;

export { supabaseUrl };
