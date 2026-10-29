import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { Language, SportMatch, SportResponse, Team } from '../lib/types'

const CACHE_KEY = 'homepage.sport'
const LIVE_POLL_MS = 60_000
const IDLE_MS = 5 * 60_000

function readCache(ids: number[]): SportResponse | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null')
    return c && c.ids === ids.join(',') ? c.data : null
  } catch { return null }
}

// One row per followed team: the match in play, else the next one (with day and hour), else the last result.
export default function SportCard({ teams, lang, t }: { teams: Team[]; lang: Language; t: T }) {
  const ids = teams.map((x) => x.id)
  const key = ids.join(',')
  const [data, setData] = useState<SportResponse | null>(() => readCache(ids))
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const load = async () => {
      const { data: d, error: e } = await supabase.functions.invoke<SportResponse>('sport', { body: { action: 'matches', ids } })
      if (cancelled) return
      if (e || !d || !d.teams) { setError(true); return }
      setError(false); setData(d)
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ids: key, data: d }))
      // While a match is on, ask again every minute; otherwise every few minutes is plenty.
      timer = window.setTimeout(load, d.teams.some((x) => x.live) ? LIVE_POLL_MS : IDLE_MS)
    }
    const cached = readCache(ids)
    const age = cached ? Date.now() - Date.parse(cached.at) : Infinity
    timer = window.setTimeout(load, cached && age < LIVE_POLL_MS ? LIVE_POLL_MS - age : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!teams.length) return null
  return (
    <section className="card sport" aria-label={t('sport.title')}>
      <b>{t('sport.title')}</b>
      {error && !data && <p className="muted sport-note">{t('sport.error')}</p>}
      <ul className="sport-list">
        {teams.map((team) => {
          const s = data?.teams.find((x) => x.team.id === team.id)
          const m = s?.live ?? s?.next ?? s?.last ?? null
          return (
            <li key={team.id} className="sport-row">
              {team.crest ? <img className="sport-crest" src={team.crest} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /> : <span className="sport-crest" />}
              <div className="sport-text">
                {!data && !error && <span className="muted">…</span>}
                {data && !m && <><span className="sport-main">{team.name}</span><span className="sport-sub">{t(s?.error ? 'sport.error' : 'sport.noMatch')}</span></>}
                {m && <MatchLine m={m} kind={s?.live ? 'live' : s?.next ? 'next' : 'last'} teamId={team.id} lang={lang} t={t} />}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MatchLine({ m, kind, teamId, lang, t }: { m: SportMatch; kind: 'live' | 'next' | 'last'; teamId: number; lang: Language; t: T }) {
  const home = m.home.shortName ?? m.home.name, away = m.away.shortName ?? m.away.name
  const when = formatWhen(m.utcDate, lang, t)
  if (kind === 'next') {
    const us = m.home.id === teamId, them = us ? away : home
    return (
      <>
        <span className="sport-main">{us ? home : away} <span className="sport-vs">{t('sport.vs')}</span> {them}</span>
        <span className="sport-sub">{when} · {m.competition.name}{m.status === 'POSTPONED' ? ` · ${t('sport.postponed')}` : ''}</span>
      </>
    )
  }
  const score = `${m.score.home ?? 0} – ${m.score.away ?? 0}`
  return (
    <>
      <span className="sport-main">{home} <span className="sport-score">{score}</span> {away}</span>
      <span className="sport-sub">
        {kind === 'live'
          ? <span className="sport-live">{m.status === 'PAUSED' ? t('sport.halfTime') : m.minute != null ? `${m.minute}'` : t('sport.live')}</span>
          : <span>{t('sport.finished')} · {when}</span>}
        {' · '}{m.competition.name}
      </span>
    </>
  )
}

// "Azi 21:45", "Mâine 18:00", "Sâm. 7 nov., 21:45"
function formatWhen(iso: string, lang: Language, t: T): string {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
  const day = (x: Date) => x.toDateString()
  const now = new Date(), tomorrow = new Date(now.getTime() + 86_400_000)
  if (day(d) === day(now)) return `${t('weather.today')} ${time}`
  if (day(d) === day(tomorrow)) return `${t('weather.tomorrow')} ${time}`
  const date = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  return `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${time}`
}
