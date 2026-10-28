import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { FeedItem, FeedsResponse, Profile } from '../lib/types'
import { timeAgo } from '../lib/time'
import { useSaved } from '../hooks/useSaved'
import ArticleCard from '../components/ArticleCard'
import WeatherCard from '../components/WeatherCard'
import { RefreshIcon } from '../components/Icons'

const CACHE_KEY = 'homepage.feed'
type Cached = FeedsResponse & { at: string }

function readCache(): Cached | null {
  try { const raw = sessionStorage.getItem(CACHE_KEY); return raw ? (JSON.parse(raw) as Cached) : null } catch { return null }
}

export default function Feed({ t, profile, userId }: { t: T; profile: Profile; userId: string }) {
  const [data, setData] = useState<Cached | null>(readCache)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const { savedIds, toggle } = useSaved(userId)

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(false)
    const { data: res, error: err } = await supabase.functions.invoke<FeedsResponse>('feeds', { body: { force } })
    if (err || !res) { setError(true); setLoading(false); return }
    const cached: Cached = { ...res, at: new Date().toISOString() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached))
    setData(cached); setLoading(false)
  }, [])

  useEffect(() => {
    const c = readCache()
    if (!c || Date.now() - Date.parse(c.at) > 5 * 60_000) void load()
  }, [load])

  const sourceName = useMemo(() => {
    const m = new Map<string, string>()
    data?.sources.forEach((s) => m.set(s.url, s.name))
    return (url: string) => m.get(url) ?? url
  }, [data])

  const items: FeedItem[] = useMemo(() => {
    const all = data?.items ?? []
    return filter === 'all' ? all : all.filter((i) => i.feed_url === filter)
  }, [data, filter])

  const failed = (data?.sources ?? []).filter((s) => s.last_error)
  const hasWeather = profile.weather_lat != null && profile.weather_lon != null
  const hour = new Date().getHours()
  const greeting = t(hour < 5 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.day' : 'greeting.evening')
  const today = new Intl.DateTimeFormat(profile.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const layoutClass = profile.layout === 'list' ? 'list' : profile.layout === 'magazine' ? 'magazine' : 'grid'

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <h1>{greeting}{profile.display_name ? `, ${profile.display_name}` : ''}</h1>
          <div className="date">{today}</div>
        </div>
        {hasWeather && (
          <WeatherCard lat={profile.weather_lat!} lon={profile.weather_lon!} city={profile.weather_city} lang={profile.language} t={t} />
        )}
      </section>

      <div className="feed-head">
        {data && <span className="muted">{t('feed.updated', { time: timeAgo(data.at, profile.language, t('time.now')) })}</span>}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => load(true)} disabled={loading} aria-label={t('feed.refresh')}>
          <RefreshIcon /> <span>{t('feed.refresh')}</span>
        </button>
      </div>

      {data && data.sources.length > 1 && (
        <div className="chips" role="group" aria-label={t('settings.sources')}>
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('feed.all')}</button>
          {data.sources.map((s) => (
            <button key={s.url} type="button" className="chip" aria-pressed={filter === s.url} onClick={() => setFilter(s.url)}>{s.name}</button>
          ))}
        </div>
      )}

      {error && <div className="msg error">{t('feed.error')}</div>}
      {failed.map((s) => <div key={s.url} className="msg" style={{ marginBottom: 8 }}>{t('feed.sourceError', { name: s.name })}</div>)}
      {loading && !data && <p className="muted">{t('feed.loading')}</p>}
      {data && items.length === 0 && !loading && <p className="muted">{t('feed.empty')}</p>}

      <div className={layoutClass}>
        {items.map((item, i) => (
          <ArticleCard key={item.id} item={item} sourceName={sourceName(item.feed_url)} lang={profile.language} t={t}
            saved={savedIds.has(item.id)} onToggleSave={toggle} showImage={profile.layout !== 'list'}
            className={profile.layout === 'magazine' && i === 0 && !!item.image_url ? 'lead' : undefined} />
        ))}
      </div>
    </>
  )
}
