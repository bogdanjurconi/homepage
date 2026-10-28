import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { QuickLink } from '../lib/types'

const CACHE_KEY = 'homepage.links'

export function useQuickLinks(userId: string) {
  const [links, setLinks] = useState<QuickLink[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '[]') as QuickLink[] } catch { return [] }
  })

  useEffect(() => {
    supabase.from('quick_links').select('id,title,url,sort_order').eq('user_id', userId).order('sort_order').order('created_at')
      .then(({ data }) => { if (data) { setLinks(data as QuickLink[]); sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)) } })
  }, [userId])

  const persist = (next: QuickLink[]) => { setLinks(next); sessionStorage.setItem(CACHE_KEY, JSON.stringify(next)) }

  const add = useCallback(async (title: string, url: string) => {
    const sort_order = links.length ? Math.max(...links.map((l) => l.sort_order)) + 1 : 0
    const { data, error } = await supabase.from('quick_links').insert({ user_id: userId, title, url, sort_order }).select('id,title,url,sort_order').single()
    if (error) return error.message
    persist([...links, data as QuickLink])
    return null
  }, [links, userId])

  const remove = useCallback(async (id: string) => {
    persist(links.filter((l) => l.id !== id))
    await supabase.from('quick_links').delete().eq('id', id)
  }, [links])

  const move = useCallback(async (id: string, dir: -1 | 1) => {
    const i = links.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= links.length) return
    const next = [...links]; [next[i], next[j]] = [next[j], next[i]]
    const renumbered = next.map((l, k) => ({ ...l, sort_order: k }))
    persist(renumbered)
    await Promise.all(renumbered.map((l) => supabase.from('quick_links').update({ sort_order: l.sort_order }).eq('id', l.id)))
  }, [links])

  return { links, add, remove, move }
}
