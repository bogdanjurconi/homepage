import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { FeedItem, Profile } from '../lib/types'
import { hostname } from '../lib/time'
import ArticleCard from '../components/ArticleCard'

type Row = { item_id: string; saved_at: string; feed_items: FeedItem | null }

export default function Saved({ t, profile, userId }: { t: T; profile: Profile; userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    supabase.from('saved_articles')
      .select('item_id, saved_at, feed_items(id, feed_url, title, link, summary, image_url, published_at)')
      .eq('user_id', userId).order('saved_at', { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []))
  }, [userId])

  async function unsave(item: FeedItem) {
    setRows((r) => (r ?? []).filter((x) => x.item_id !== item.id))
    await supabase.from('saved_articles').delete().eq('user_id', userId).eq('item_id', item.id)
  }

  const items = (rows ?? []).map((r) => r.feed_items).filter((i): i is FeedItem => !!i)

  return (
    <>
      <h1>{t('saved.title')}</h1>
      {rows && items.length === 0 && <p className="muted">{t('saved.empty')}</p>}
      <div className={profile.layout === 'list' ? 'list' : 'grid'}>
        {items.map((item) => (
          <ArticleCard key={item.id} item={item} sourceName={hostname(item.link)} lang={profile.language} t={t}
            saved onToggleSave={unsave} showImage={profile.layout === 'cards'} />
        ))}
      </div>
    </>
  )
}
