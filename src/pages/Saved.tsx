import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { FeedItem, Profile } from '../lib/types'
import { hostname } from '../lib/time'
import { readFeedCache } from '../lib/feedCache'
import ArticleCard from '../components/ArticleCard'

type Row = { item_id: string; saved_at: string; feed_items: FeedItem | null }
type NamedSource = { url: string | null; name: string | null }

export default function Saved({ t, profile, userId }: { t: T; profile: Profile; userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  // Friendly source names, seeded from the cached feed (the sources switched on) and completed below with the defaults
  // table and the user's own named sources, so a story from a source switched off keeps its name; the hostname is the last resort.
  const [names, setNames] = useState(() => new Map((readFeedCache()?.sources ?? []).map((s) => [s.url, s.name])))

  useEffect(() => {
    supabase.from('saved_articles')
      .select('item_id, saved_at, feed_items(id, feed_url, title, link, summary, image_url, published_at)')
      .eq('user_id', userId).order('saved_at', { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []))
    // the tables only fill the gaps, so the cached names stay exactly as the feed shows them
    const fill = (data: NamedSource[] | null) => {
      if (data?.length) setNames((n) => new Map([...data.flatMap((s) => (s.url && s.name ? [[s.url, s.name] as const] : [])), ...n]))
    }
    supabase.from('default_sources').select('url, name').then(({ data }) => fill(data as NamedSource[] | null))
    supabase.from('user_sources').select('url, name').eq('user_id', userId).then(({ data }) => fill(data as NamedSource[] | null))
  }, [userId])

  async function unsave(item: FeedItem) {
    setRows((r) => (r ?? []).filter((x) => x.item_id !== item.id))
    await supabase.from('saved_articles').delete().eq('user_id', userId).eq('item_id', item.id)
  }

  const items = (rows ?? []).map((r) => r.feed_items).filter((i): i is FeedItem => !!i)

  return (
    <>
      <h1 className="page-title">{t('saved.title')}</h1>
      {rows === null && <p className="muted">{t('saved.loading')}</p>}
      {rows && items.length === 0 && <p className="muted">{t('saved.empty')}</p>}
      <div className={profile.layout === 'list' ? 'list' : 'grid'}>
        {items.map((item) => (
          <ArticleCard key={item.id} item={item} sourceName={names.get(item.feed_url) ?? hostname(item.link)} lang={profile.language} t={t}
            saved onToggleSave={unsave} showImage={profile.layout !== 'list'} openInReader={profile.open_in_reader} showSummary={profile.show_summary} />
        ))}
      </div>
    </>
  )
}
