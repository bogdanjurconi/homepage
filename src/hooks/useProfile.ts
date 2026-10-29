import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_PROFILE, type Profile } from '../lib/types'
import { takePendingLanguage } from '../lib/guestLanguage'

const CACHE_KEY = 'homepage.profile'

function readCache(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Profile
    // Older cached copies lack newer fields (e.g. teams): fill them from the defaults.
    return p.id === userId ? { ...DEFAULT_PROFILE, ...p } : null
  } catch { return null }
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(() => (userId ? readCache(userId) : null))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  // Several updates can be in flight at once (two switches within one round-trip): "saving" stays on
  // until the last one has answered, and a failure is not wiped by a later success.
  const inflight = useRef(0)
  const failed = useRef(false)

  useEffect(() => {
    if (!userId) { setProfile(null); return }
    let cancelled = false
    // Show the cached copy at once (the inline script in index.html already painted from it);
    // the server copy replaces it when it arrives.
    const cached = readCache(userId)
    if (cached) setProfile(cached)
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(async ({ data }) => {
      if (cancelled) return
      const pending = takePendingLanguage()
      if (data) {
        const loaded: Profile = { ...DEFAULT_PROFILE, ...(data as Profile), ...(pending ? { language: pending } : {}) }
        if (!Array.isArray(loaded.teams)) loaded.teams = []
        setProfile(loaded); localStorage.setItem(CACHE_KEY, JSON.stringify(loaded))
        if (pending && pending !== (data as Profile).language) await supabase.from('profiles').update({ language: pending }).eq('id', userId)
        return
      }
      const fresh: Profile = { id: userId, ...DEFAULT_PROFILE, ...(pending ? { language: pending } : {}) }
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
    inflight.current++
    setSaving(true)
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) failed.current = true
    if (--inflight.current === 0) { setSaving(false); setSaveError(failed.current); failed.current = false }
  }, [userId])

  // Apply appearance to the document so every page, including Login, follows it.
  useEffect(() => {
    // Nothing known yet (signed out, or still loading): keep what the inline script in
    // index.html applied from the cache, so a cold load does not flash the defaults.
    if (!profile) return
    const root = document.documentElement
    const p = profile
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme = p.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : p.theme
      root.dataset.accent = p.accent
      root.dataset.size = p.text_size
      root.dataset.font = p.font
      root.dataset.bg = p.background
      // The Android address bar follows the page background, paper variant included.
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
      if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [profile])

  return { profile, update, saving, saveError }
}
