import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FeedItem } from '../lib/types'

export function useSaved(userId: string) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.from('saved_articles').select('item_id').eq('user_id', userId)
      .then(({ data }) => setSavedIds(new Set((data ?? []).map((r) => r.item_id as string))))
  }, [userId])

  const toggle = useCallback(async (item: FeedItem) => {
    const isSaved = savedIds.has(item.id)
    setSavedIds((s) => { const n = new Set(s); if (isSaved) n.delete(item.id); else n.add(item.id); return n })
    if (isSaved) await supabase.from('saved_articles').delete().eq('user_id', userId).eq('item_id', item.id)
    else await supabase.from('saved_articles').insert({ user_id: userId, item_id: item.id })
  }, [savedIds, userId])

  return { savedIds, toggle }
}
