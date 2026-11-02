import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FeedItem } from '../lib/types'

// The ids of the stories a person saved, kept per account in localStorage so the stars show at once; the
// server copy replaces it when it arrives.
const key = (userId: string) => `homepage.saved.${userId}`
const readIds = (userId: string): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(key(userId)) ?? '[]') as string[]) } catch { return new Set() }
}
const writeIds = (userId: string, ids: Set<string>) => { try { localStorage.setItem(key(userId), JSON.stringify([...ids])) } catch { /* ignore */ } }

export function useSaved(userId: string) {
  const [savedIds, setSavedIds] = useState<Set<string>>(() => readIds(userId))
  const current = useRef(savedIds)
  useEffect(() => { current.current = savedIds }, [savedIds])

  useEffect(() => {
    supabase.from('saved_articles').select('item_id').eq('user_id', userId)
      .then(({ data, error }) => { if (!error && data) { const ids = new Set(data.map((r) => r.item_id as string)); writeIds(userId, ids); setSavedIds(ids) } })
  }, [userId])

  // Stable across renders (the cards are memoised on it); the current set is read from the ref.
  const toggle = useCallback(async (item: FeedItem) => {
    const isSaved = current.current.has(item.id)
    setSavedIds((s) => { const n = new Set(s); if (isSaved) n.delete(item.id); else n.add(item.id); writeIds(userId, n); return n })
    if (isSaved) await supabase.from('saved_articles').delete().eq('user_id', userId).eq('item_id', item.id)
    else await supabase.from('saved_articles').insert({ user_id: userId, item_id: item.id })
  }, [userId])

  return { savedIds, toggle }
}
