import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_PROFILE, type Profile } from '../lib/types'

const CACHE_KEY = 'homepage.profile'

function readCache(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Profile
    return p.id === userId ? p : null
  } catch { return null }
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(() => (userId ? readCache(userId) : null))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) { setProfile(null); return }
    let cancelled = false
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(async ({ data }) => {
      if (cancelled) return
      if (data) { setProfile(data as Profile); localStorage.setItem(CACHE_KEY, JSON.stringify(data)); return }
      const fresh: Profile = { id: userId, ...DEFAULT_PROFILE }
      await supabase.from('profiles').upsert(fresh)
      if (!cancelled) setProfile(fresh)
    })
    return () => { cancelled = true }
  }, [userId])

  const update = useCallback(async (patch: Partial<Omit<Profile, 'id'>>) => {
    if (!userId) return
    setProfile((p) => {
      const next = { ...(p ?? { id: userId, ...DEFAULT_PROFILE }), ...patch }
      localStorage.setItem(CACHE_KEY, JSON.stringify(next))
      return next
    })
    setSaving(true)
    await supabase.from('profiles').update(patch).eq('id', userId)
    setSaving(false)
  }, [userId])

  // Apply appearance to the document so every page, including Login, follows it.
  useEffect(() => {
    const root = document.documentElement
    const p = profile ?? { ...DEFAULT_PROFILE, id: '' }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme = p.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : p.theme
      root.dataset.accent = p.accent
      root.dataset.size = p.text_size
      root.dataset.font = p.font
      root.dataset.bg = p.background
      root.lang = p.language
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [profile])

  return { profile, update, saving }
}
