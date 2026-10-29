import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Key, T } from '../lib/i18n'
import { CATEGORY_ORDER, type Category, type FeedItem, type FeedsResponse, type Profile } from '../lib/types'
import { timeAgo } from '../lib/time'
import { FEED_CACHE_KEY, readFeedCache, type CachedFeed } from '../lib/feedCache'
import { useSaved } from '../hooks/useSaved'
import { useQuickLinks } from '../hooks/useQuickLinks'
import { usePaged } from '../hooks/usePaged'
import { mixSources, pickLeads } from '../lib/mix'
import { useMedia } from '../hooks/useMedia'
import ArticleCard from '../components/ArticleCard'
import WeatherCard from '../components/WeatherCard'
import RatesCard from '../components/RatesCard'
import SportCard from '../components/SportCard'
import CalendarCard from '../components/CalendarCard'
import SearchBar from '../components/SearchBar'
import QuickLinks from '../components/QuickLinks'
import { RefreshIcon, SearchIcon } from '../components/Icons'

// Diacritics-insensitive, case-insensitive match for the news filter.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Feed({ t, profile, userId }: { t: T; profile: Profile; userId: string }) {
  const [data, setData] = useState<CachedFeed | null>(readFeedCache)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState(false)
  const [section, setSection] = useState<Category | 'all'>('all')
  // Same breakpoint as the one-column CSS: below it the phone layout applies.
  const phone = useMedia('(max-width: 719px)')
  const [query, setQuery] = useState('')
  const { savedIds, toggle } = useSaved(userId)
  const { links } = useQuickLinks(userId)

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(false)
    const { data: res, error: err } = await supabase.functions.invoke<FeedsResponse>('feeds', { body: { force } })
    if (err || !res) { setError(true); setLoading(false); return }
    const cached: CachedFeed = { ...res, at: new Date().toISOString() }
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(cached))
    setData(cached); setLoading(false)
  }, [])

  useEffect(() => {
    const c = readFeedCache()
    if (!c || Date.now() - Date.parse(c.at) > 5 * 60_000) void load()
  }, [load])

  const sourceByUrl = useMemo(() => new Map((data?.sources ?? []).map((s) => [s.url, s])), [data])
  const sourceName = (url: string) => sourceByUrl.get(url)?.name ?? url

  const sections = useMemo(() => {
    const present = new Set((data?.sources ?? []).map((s) => s.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [data])

  // Phones show one column, where the magazine would only be cards with a bigger title: they get the cards.
  const layout = phone && profile.layout === 'magazine' ? 'cards' : profile.layout
  const layoutClass = layout === 'list' ? 'list' : layout === 'magazine' ? 'magazine' : 'grid'
  const { items, leads } = useMemo<{ items: FeedItem[]; leads: Set<string> }>(() => {
    let all = data?.items ?? []
    if (section !== 'all') all = all.filter((i) => sourceByUrl.get(i.feed_url)?.category === section)
    const q = fold(query.trim())
    if (q) all = all.filter((i) => fold(`${i.title} ${i.summary ?? ''} ${sourceName(i.feed_url)}`).includes(q))
    // A busy source may not crowd out the quiet ones; the magazine then chooses its large stories.
    const mixed = mixSources(all)
    return layout === 'magazine' ? pickLeads(mixed) : { items: mixed, leads: new Set<string>() }
  }, [data, section, query, sourceByUrl, layout]) // eslint-disable-line react-hooks/exhaustive-deps
  // Cards are rendered a page at a time; the rest follow as the reader scrolls. A refresh keeps the
  // depth already revealed, so a background update never pulls the list away from under the reader.
  const { shown, hasMore, more, sentinel } = usePaged(items, `${section}|${query}`)

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
        {shown.map((item) => (
          <ArticleCard key={item.id} item={item} sourceName={sourceName(item.feed_url)} lang={profile.language} t={t}
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
