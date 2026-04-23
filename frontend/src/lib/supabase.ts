import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawSupabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis dans le fichier .env')
}

function normalizeSupabaseUrl(rawUrl: string) {
  const parsed = new URL(rawUrl.trim())
  return parsed.origin
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)