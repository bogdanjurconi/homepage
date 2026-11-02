import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Key, T } from '../lib/i18n'
import { CATEGORY_ORDER, type Category, type FeedItem, type FeedsResponse, type Profile } from '../lib/types'
import { timeAgo } from '../lib/time'
import { readFeedCache, writeFeedCache, type CachedFeed } from '../lib/feedCache'
import { useSaved } from '../hooks/useSaved'
import { useQuickLinks } from '../hooks/useQuickLinks'
import { usePaged } from '../hooks/usePaged'
import { mixSources, pickLeads } from '../lib/mix'
import ArticleCard from '../components/ArticleCard'
import SourceRow from '../components/SourceRow'
import WeatherCard from '../components/WeatherCard'
import RatesCard from '../components/RatesCard'
import SportCard from '../components/SportCard'
import CalendarCard from '../components/CalendarCard'
import SearchBar from '../components/SearchBar'
import QuickLinks from '../components/QuickLinks'
import { RefreshIcon, SearchIcon } from '../components/Icons'

// Diacritics-insensitive, case-insensitive match for the news filter.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const ROW_LIMIT = 15

// One row per source, each newest first. Rows stay in a fixed order so they are where the reader left them:
// alphabetical by name, or the person's own order (sources missing from it follow, alphabetically).
function groupBySource(items: FeedItem[], limit: number, nameOf: (url: string) => string, order: string[] | null): { url: string; site: string | null; items: FeedItem[] }[] {
  const rows = new Map<string, FeedItem[]>()
  for (const it of items) {
    const r = rows.get(it.feed_url)
    if (r) { if (r.length < limit) r.push(it) } else rows.set(it.feed_url, [it])
  }
  const rank = (url: string) => { const i = order ? order.indexOf(url) : -1; return i < 0 ? Infinity : i }
  return [...rows.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), 'ro', { sensitivity: 'base' }))
    .map(([url, list]) => {
      let site: string | null = null
      try { site = new URL(list[0].link).origin } catch { /* a feed without proper links: no site link */ }
      return { url, site, items: list }
    })
}

export default function Feed({ t, profile, userId }: { t: T; profile: Profile; userId: string }) {
  const [data, setData] = useState<CachedFeed | null>(() => readFeedCache(userId))
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState(false)
  const [section, setSection] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')
  const { savedIds, toggle } = useSaved(userId)
  const { links } = useQuickLinks(userId)

  const retryTimer = useRef(0)
  const load = useCallback(async (force = false, attempt = 0) => {
    setLoading(true); setError(false)
    const { data: res, error: err } = await supabase.functions.invoke<FeedsResponse>('feeds', { body: { force } })
    if (err || !res) { setError(true); setLoading(false); return }
    const cached: CachedFeed = { ...res, at: new Date().toISOString() }
    writeFeedCache(userId, cached)
    setData(cached); setLoading(false)
    // The server answered from its cache while it was still refreshing some sources: ask again, once or twice.
    if (res.refreshing?.length && attempt < 2) {
      window.clearTimeout(retryTimer.current)
      retryTimer.current = window.setTimeout(() => void load(false, attempt + 1), res.retry_after_ms || 8_000)
    }
  }, [userId])
  useEffect(() => () => window.clearTimeout(retryTimer.current), [])

  useEffect(() => {
    const c = readFeedCache(userId)
    if (!c || Date.now() - Date.parse(c.at) > 5 * 60_000) void load()
  }, [load, userId])

  const sourceByUrl = useMemo(() => new Map((data?.sources ?? []).map((s) => [s.url, s])), [data])
  const sourceName = (url: string) => sourceByUrl.get(url)?.name ?? url
  // The filter's text per story, folded once per load rather than on every keystroke.
  const folded = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, fold(`${i.title} ${i.summary ?? ''} ${sourceByUrl.get(i.feed_url)?.name ?? ''}`)])), [data, sourceByUrl])

  const sections = useMemo(() => {
    const present = new Set((data?.sources ?? []).map((s) => s.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [data])

  const layout = profile.layout
  const layoutClass = layout === 'list' ? 'list' : layout === 'magazine' ? 'magazine' : layout === 'bysource' ? 'bysource' : 'grid'
  const { items, leads } = useMemo<{ items: FeedItem[]; leads: Set<string> }>(() => {
    let all = data?.items ?? []
    if (section !== 'all') all = all.filter((i) => sourceByUrl.get(i.feed_url)?.category === section)
    const q = fold(query.trim())
    if (q) all = all.filter((i) => folded.get(i.id)?.includes(q))
    // By source, each source has its own row, newest first: no mixing needed.
    if (layout === 'bysource') return { items: all, leads: new Set<string>() }
    // A busy source may not crowd out the quiet ones; the magazine then chooses its large stories.
    const mixed = mixSources(all, profile.mix_balance / 4)
    return layout === 'magazine' ? pickLeads(mixed) : { items: mixed, leads: new Set<string>() }
  }, [data, section, query, sourceByUrl, folded, layout, profile.mix_balance])
  // Cards are rendered a page at a time; the rest follow as the reader scrolls. A refresh keeps the
  // depth already revealed, so a background update never pulls the list away from under the reader.
  const paged = usePaged(items, `${section}|${query}`)
  // By source there is no single list to page: every row shows its own first stories.
  const { shown, hasMore, more, sentinel } = layout === 'bysource' ? { ...paged, shown: items, hasMore: false } : paged
  const rows = useMemo(() => layout === 'bysource' ? groupBySource(items, ROW_LIMIT, sourceName, profile.source_sort === 'custom' ? profile.source_order : null) : [],
    [items, layout, profile.source_sort, profile.source_order]) // eslint-disable-line react-hooks/exhaustive-deps

  const failed = (data?.sources ?? []).filter((s) => s.last_error)
  const hasWeather = profile.weather_lat != null && profile.weather_lon != null
  const hour = new Date().getHours()
  const greeting = t(hour < 5 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.day' : 'greeting.evening')
  const today = new Intl.DateTimeFormat(profile.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const showSideWidgets = profile.show_rates || profile.show_calendar || profile.teams.length > 0

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

      {profile.show_search && <SearchBar engine={profile.search_engine} t={t} />}
      <QuickLinks links={links} label={t('links.title')} />

      {showSideWidgets && (
        <div className="widgets">
          {profile.show_calendar && <CalendarCard lang={profile.language} t={t} />}
          {profile.show_rates && <RatesCard lang={profile.language} t={t} codes={profile.rate_currencies} />}
          {profile.teams.length > 0 && <SportCard teams={profile.teams} lang={profile.language} t={t} />}
        </div>
      )}

      <div className="feed-head">
        <h2>{t('nav.feed')}</h2>
        {data && <span className="muted">· {t('feed.updated', { time: timeAgo(data.at, profile.language, t('time.now')) })}</span>}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => load(true)} disabled={loading} aria-label={t('feed.refresh')}>
          <RefreshIcon /> <span>{t('feed.refresh')}</span>
        </button>
      </div>

      {data && (
        <div className="filter-row">
          {sections.length > 1 && (
            <div className="chips" role="group" aria-label={t('feed.sections')}>
              <button type="button" className="chip" aria-pressed={section === 'all'} onClick={() => setSection('all')}>{t('feed.all')}</button>
              {sections.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={section === c} onClick={() => setSection(c)}>{t(`category.${c}` as Key)}</button>
              ))}
            </div>
          )}
          <label className="filter-box">
            <SearchIcon />
            <input type="search" autoComplete="off" placeholder={t('feed.filter')} aria-label={t('feed.filter')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      )}

      {error && <div className="msg error">{t('feed.error')}</div>}
      {failed.map((s) => <div key={s.url} className="msg">{t('feed.sourceError', { name: s.name })}</div>)}
      {loading && !data && <p className="muted">{t('feed.loading')}</p>}
      {data && items.length === 0 && !loading && (
        <p className="muted">{data.items.length ? t('feed.noMatch') : t('feed.empty')}</p>
      )}

      <div className={layoutClass}>
        {layout === 'bysource' && rows.map((row, ri) => (
          <SourceRow key={row.url} name={sourceName(row.url)} href={row.site} t={t}>
            {row.items.map((item, i) => (
              <ArticleCard key={item.id} item={item} sourceName={sourceName(item.feed_url)} lang={profile.language} t={t} eager={ri === 0 && i < 3}
                saved={savedIds.has(item.id)} onToggleSave={toggle} showImage openInReader={profile.open_in_reader} showSummary={profile.show_summary} />
            ))}
          </SourceRow>
        ))}
        {layout !== 'bysource' && shown.map((item, i) => (
          <ArticleCard key={item.id} item={item} sourceName={sourceName(item.feed_url)} lang={profile.language} t={t} eager={i < 4}
            saved={savedIds.has(item.id)} onToggleSave={toggle} showImage compact={layout === 'list'} openInReader={profile.open_in_reader} showSummary={profile.show_summary}
            className={leads.has(item.id) ? 'lead' : undefined} />
        ))}
      </div>
      {hasMore && (
        <div className="feed-more" ref={sentinel}>
          <button type="button" className="btn ghost" onClick={more}>{t('feed.more')}</button>
        </div>
      )}
    </>
  )
}
