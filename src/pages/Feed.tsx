import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Key, T } from '../lib/i18n'
import { CATEGORY_ORDER, type Category, type FeedItem, type FeedsResponse, type Profile } from '../lib/types'
import { timeAgo } from '../lib/time'
import { useSaved } from '../hooks/useSaved'
import { useQuickLinks } from '../hooks/useQuickLinks'
import ArticleCard from '../components/ArticleCard'
import WeatherCard from '../components/WeatherCard'
import RatesCard from '../components/RatesCard'
import CalendarCard from '../components/CalendarCard'
import SearchBar from '../components/SearchBar'
import QuickLinks from '../components/QuickLinks'
import { RefreshIcon, SearchIcon } from '../components/Icons'

const CACHE_KEY = 'homepage.feed'
type Cached = FeedsResponse & { at: string }

function readCache(): Cached | null {
  try { const raw = sessionStorage.getItem(CACHE_KEY); return raw ? (JSON.parse(raw) as Cached) : null } catch { return null }
}

// Diacritics-insensitive, case-insensitive match for the news filter.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Feed({ t, profile, userId }: { t: T; profile: Profile; userId: string }) {
  const [data, setData] = useState<Cached | null>(readCache)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState(false)
  const [section, setSection] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')
  const { savedIds, toggle } = useSaved(userId)
  const { links } = useQuickLinks(userId)

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

  const sourceByUrl = useMemo(() => new Map((data?.sources ?? []).map((s) => [s.url, s])), [data])
  const sourceName = (url: string) => sourceByUrl.get(url)?.name ?? url

  const sections = useMemo(() => {
    const present = new Set((data?.sources ?? []).map((s) => s.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [data])

  const items: FeedItem[] = useMemo(() => {
    let all = data?.items ?? []
    if (section !== 'all') all = all.filter((i) => sourceByUrl.get(i.feed_url)?.category === section)
    const q = fold(query.trim())
    if (q) all = all.filter((i) => fold(`${i.title} ${i.summary ?? ''} ${sourceName(i.feed_url)}`).includes(q))
    return all
  }, [data, section, query, sourceByUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const failed = (data?.sources ?? []).filter((s) => s.last_error)
  const hasWeather = profile.weather_lat != null && profile.weather_lon != null
  const hour = new Date().getHours()
  const greeting = t(hour < 5 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.day' : 'greeting.evening')
  const today = new Intl.DateTimeFormat(profile.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const layoutClass = profile.layout === 'list' ? 'list' : profile.layout === 'magazine' ? 'magazine' : 'grid'
  const showSideWidgets = profile.show_rates || profile.show_calendar

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

      <SearchBar engine={profile.search_engine} t={t} />
      <QuickLinks links={links} label={t('links.title')} />

      {showSideWidgets && (
        <div className="widgets">
          {profile.show_calendar && <CalendarCard lang={profile.language} t={t} />}
          {profile.show_rates && <RatesCard lang={profile.language} t={t} codes={profile.rate_currencies} />}
        </div>
      )}

      <div className="feed-head">
        <h2 style={{ margin: 0 }}>{t('nav.feed')}</h2>
        {data && <span className="muted">· {t('feed.updated', { time: timeAgo(data.at, profile.language, t('time.now')) })}</span>}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => load(true)} disabled={loading} aria-label={t('feed.refresh')}>
          <RefreshIcon /> <span>{t('feed.refresh')}</span>
        </button>
      </div>

      {data && (
        <div className="filter-row">
          {sections.length > 1 && (
            <div className="chips" role="group" aria-label={t('settings.sources')}>
              <button type="button" className="chip" aria-pressed={section === 'all'} onClick={() => setSection('all')}>{t('feed.all')}</button>
              {sections.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={section === c} onClick={() => setSection(c)}>{t(`category.${c}` as Key)}</button>
              ))}
            </div>
          )}
          <label className="filter-box">
            <SearchIcon />
            <input type="search" placeholder={t('feed.filter')} aria-label={t('feed.filter')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      )}

      {error && <div className="msg error">{t('feed.error')}</div>}
      {failed.map((s) => <div key={s.url} className="msg" style={{ marginBottom: 8 }}>{t('feed.sourceError', { name: s.name })}</div>)}
      {loading && !data && <p className="muted">{t('feed.loading')}</p>}
      {data && items.length === 0 && !loading && <p className="muted">{t('feed.empty')}</p>}

      <div className={layoutClass}>
        {items.map((item, i) => (
          <ArticleCard key={item.id} item={item} sourceName={sourceName(item.feed_url)} lang={profile.language} t={t}
            saved={savedIds.has(item.id)} onToggleSave={toggle} showImage={profile.layout !== 'list'} openInReader={profile.open_in_reader} showSummary={profile.show_summary}
            className={profile.layout === 'magazine' && i === 0 && !!item.image_url ? 'lead' : undefined} />
        ))}
      </div>
    </>
  )
}
