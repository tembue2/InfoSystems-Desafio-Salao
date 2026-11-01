'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { publicSupabaseConfig } from './config';

export function createClient() {
  const { url, key } = publicSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
