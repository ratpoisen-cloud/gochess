import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isConfigured = SUPABASE_URL && SUPABASE_ANON_KEY

if (!isConfigured) {
  console.warn('Supabase credentials not set. Auth features will be disabled.')
}

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: {
        timeout: 60000,
      },
      realtime: {
        heartbeatIntervalMs: 15000,
      },
    })
  : null
export { isConfigured }
