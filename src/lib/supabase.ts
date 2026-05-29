import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const REQUEST_TIMEOUT = 20000

const isConfigured = SUPABASE_URL && SUPABASE_ANON_KEY

if (!isConfigured) {
  console.warn('Supabase credentials not set. Auth features will be disabled.')
}

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const signal = init?.signal
  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId))
}

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        heartbeatIntervalMs: 15000,
      },
      global: {
        fetch: fetchWithTimeout,
      },
    })
  : null
export { isConfigured }
