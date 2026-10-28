import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship to the browser: every table is protected by row-level security.
export const SUPABASE_URL = 'https://moiztlyqhycdhwttvkrk.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wuVKhq3BCRe7U5wQwWchzA_hQ-K9r4H'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
