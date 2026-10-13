import { createClient } from '@supabase/supabase-js';

// Supabase client — safe to import even without env vars.
// Falls back to `null` so the app runs in local demo mode.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anon!)
  : null;

export const ORG_ID = 'demo-org-001';
export const BRANCH_ID = 'demo-branch-001';
