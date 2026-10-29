import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { Language, SportMatch, SportResponse, Team } from '../lib/types'

const CACHE_KEY = 'homepage.sport'
const LIVE_POLL_MS = 60_000
const IDLE_MS = 30 * 60_000

// Without a match on, the next useful moment is the earliest kick-off (or half an hour, whichever comes first).
function nextPoll(d: SportResponse): number {
  if (d.teams.some((x) => x.live)) return LIVE_POLL_MS
  const kickoffs = d.teams.map((x) => x.next && Date.parse(x.next.utcDate) - Date.now()).filter((ms): ms is number => typeof ms === 'number')
  const soonest = Math.min(IDLE_MS, ...kickoffs)
  return Math.max(LIVE_POLL_MS, soonest)
}

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
      // Every minute while a match is on; otherwise at the next kick-off, at most half an hour later.
      timer = window.setTimeout(load, nextPoll(d))
    }
    const cached = readCache(ids)
    const age = cached ? Date.now() - Date.parse(cached.at) : Infinity
    timer = window.setTimeout(load, cached && age < nextPoll(cached) ? nextPoll(cached) - age : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!teams.length) return null
  // One block per followed team; two teams playing each other share one block.
  const seen = new Set<number>()
  return (
    <section className="card sport" aria-label={t('sport.title')}>
      <b>{t('sport.title')}</b>
      {error && !data && <p className="muted sport-note">{t('sport.error')}</p>}
      {!data && !error && <p className="muted sport-note">…</p>}
      {data && (
        <ul className="sport-list">
          {[...teams].sort((a, b) => order(data, a.id) - order(data, b.id)).map((team) => {
            const s = data.teams.find((x) => x.team.id === team.id)
            const m = s?.live ?? s?.next ?? s?.last ?? null
            if (m && seen.has(m.id)) return null
            if (m) seen.add(m.id)
            if (!m) return (
              <li key={team.id} className="match">
                <div className="match-row match-row-single">
                  <TeamSide side={{ id: team.id, name: team.name, shortName: null, tla: team.tla, crest: team.crest }} followed />
                  <div className="match-mid"><small>{t(s?.error ? 'sport.error' : 'sport.noMatch')}</small></div>
                </div>
              </li>
            )
            const kind = s?.live ? 'live' : s?.next ? 'next' : 'last'
            const followed = new Set(teams.map((x) => x.id))
            const score = `${m.score.home ?? 0} – ${m.score.away ?? 0}`
            return (
              <li key={team.id} className="match">
                <div className="match-meta">{kind === 'next' ? `${dayOf(m.utcDate, lang, t)} · ` : ''}{m.competition.name}</div>
                <div className="match-row">
                  <TeamSide side={m.home} followed={followed.has(m.home.id)} />
                  <div className="match-mid">
                    {kind === 'next' && <><b>{timeOf(m.utcDate, lang)}</b>{m.status === 'POSTPONED' && <small>{t('sport.postponed')}</small>}</>}
                    {kind === 'live' && <><b>{score}</b><small className="sport-live">{m.status === 'PAUSED' ? t('sport.halfTime') : m.minute != null ? `${m.minute}'` : t('sport.live')}</small></>}
                    {kind === 'last' && <><b>{score}</b><small>{t('sport.finished')}</small></>}
                  </div>
                  <TeamSide side={m.away} followed={followed.has(m.away.id)} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// Live matches first, then upcoming ones by kick-off, then the last results, then teams with nothing on.
function order(data: SportResponse, id: number): number {
  const s = data.teams.find((x) => x.team.id === id)
  if (s?.live) return 0
  if (s?.next) return 1 + Date.parse(s.next.utcDate) / 1e13
  if (s?.last) return 3 - Date.parse(s.last.utcDate) / 1e13
  return 4
}

function TeamSide({ side, followed }: { side: SportMatch['home']; followed: boolean }) {
  return (
    <div className={`match-side${followed ? ' followed' : ''}`}>
      {side.crest ? <img className="sport-crest" src={side.crest} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /> : <span className="sport-crest" />}
      <span className="match-name">{side.shortName ?? side.name}</span>
    </div>
  )
}

const timeOf = (iso: string, lang: Language) => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

// "Azi", "Mâine", "Sâm., 31 oct."
function dayOf(iso: string, lang: Language, t: T): string {
  const d = new Date(iso), now = new Date(), tomorrow = new Date(now.getTime() + 86_400_000)
  if (d.toDateString() === now.toDateString()) return t('weather.today')
  if (d.toDateString() === tomorrow.toDateString()) return t('weather.tomorrow')
  const date = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  return date.charAt(0).toUpperCase() + date.slice(1)
}
