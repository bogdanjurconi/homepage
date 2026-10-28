import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Key, T } from '../lib/i18n'
import { ACCENTS, BACKGROUNDS, FONTS, LAYOUTS, SEARCH_ENGINES, TEXT_SIZES, type Accent, type Background, type DefaultSource, type Font, type Layout, type Profile, type SearchEngine, type TextSize, type Theme, type UserSource } from '../lib/types'
import { useQuickLinks } from '../hooks/useQuickLinks'
import { faviconFor } from '../components/QuickLinks'
import { hostname } from '../lib/time'

type Props = { t: T; profile: Profile; update: (p: Partial<Omit<Profile, 'id'>>) => Promise<void>; saving: boolean; userId: string }

const ACCENT_HEX: Record<Accent, string> = { blue: '#2563eb', indigo: '#4f46e5', purple: '#7c3aed', pink: '#db2777', red: '#dc2626', orange: '#ea580c', amber: '#d97706', green: '#15803d', teal: '#0d9488', slate: '#475569' }

export default function Settings({ t, profile, update, saving, userId }: Props) {
  const [name, setName] = useState(profile.display_name ?? '')
  useEffect(() => setName(profile.display_name ?? ''), [profile.display_name])

  return (
    <div className="settings">
      <h1>{t('settings.title')}</h1>

      <section className="card section" aria-labelledby="s-profile">
        <h2 id="s-profile">{t('settings.profile')}</h2>
        <label className="field">
          <span>{t('settings.name')}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== (profile.display_name ?? '') && update({ display_name: name.trim() || null })} />
        </label>
        <div className="field">
          <span>{t('settings.language')}</span>
          <Segmented value={profile.language} options={[['ro', 'Română'], ['en', 'English']]} onChange={(v) => update({ language: v })} />
        </div>
      </section>

      <section className="card section" aria-labelledby="s-look">
        <h2 id="s-look">{t('settings.appearance')}</h2>
        <div className="field">
          <span>{t('settings.theme')}</span>
          <Segmented<Theme> value={profile.theme} options={[['auto', t('theme.auto')], ['light', t('theme.light')], ['dark', t('theme.dark')]]} onChange={(v) => update({ theme: v })} />
        </div>
        <div className="field">
          <span>{t('settings.accent')}</span>
          <div className="swatches" role="radiogroup" aria-label={t('settings.accent')}>
            {ACCENTS.map((a) => (
              <button key={a} type="button" className="swatch" style={{ background: ACCENT_HEX[a] }} aria-pressed={profile.accent === a}
                aria-label={t(`accent.${a}` as Key)} title={t(`accent.${a}` as Key)} onClick={() => update({ accent: a })} />
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('settings.textSize')}</span>
          <Segmented<TextSize> value={profile.text_size} options={TEXT_SIZES.map((s) => [s, t(`size.${s}` as Key)] as [TextSize, string])} onChange={(v) => update({ text_size: v })} />
        </div>
        <div className="field">
          <span>{t('settings.layout')}</span>
          <Segmented<Layout> value={profile.layout} options={LAYOUTS.map((l) => [l, t(`layout.${l}` as Key)] as [Layout, string])} onChange={(v) => update({ layout: v })} />
        </div>
        <div className="field">
          <span>{t('settings.font')}</span>
          <Segmented<Font> value={profile.font} options={FONTS.map((f) => [f, t(`font.${f}` as Key)] as [Font, string])} onChange={(v) => update({ font: v })} />
        </div>
        <div className="field">
          <span>{t('settings.background')}</span>
          <Segmented<Background> value={profile.background} options={BACKGROUNDS.map((b) => [b, t(`bg.${b}` as Key)] as [Background, string])} onChange={(v) => update({ background: v })} />
        </div>
      </section>

      <section className="card section" aria-labelledby="s-front">
        <h2 id="s-front">{t('settings.frontPage')}</h2>
        <Toggle label={t('settings.showRates')} on={profile.show_rates} onChange={(v) => update({ show_rates: v })} />
        <Toggle label={t('settings.showCalendar')} on={profile.show_calendar} onChange={(v) => update({ show_calendar: v })} />
        <Toggle label={t('settings.openInReader')} on={profile.open_in_reader} onChange={(v) => update({ open_in_reader: v })} />
        <div className="field">
          <span>{t('settings.searchEngine')}</span>
          <Segmented<SearchEngine> value={profile.search_engine} options={SEARCH_ENGINES.map((e) => [e, t(`engine.${e}` as Key)] as [SearchEngine, string])} onChange={(v) => update({ search_engine: v })} />
        </div>
      </section>

      <Links t={t} userId={userId} />
      <Sources t={t} userId={userId} />
      <Weather t={t} profile={profile} update={update} />

      <div className="row">
        <span className="status">{saving ? t('settings.saving') : ''}</span>
        <span className="spacer" />
        <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>{t('settings.signOut')}</button>
      </div>
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div className="grow">{label}</div>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  )
}

const SUGGESTED_LINKS: [string, string][] = [
  ['YouTube', 'https://www.youtube.com'], ['Gmail', 'https://mail.google.com'], ['Facebook', 'https://www.facebook.com'],
  ['WhatsApp', 'https://web.whatsapp.com'], ['Google Maps', 'https://maps.google.com'], ['Wikipedia', 'https://ro.wikipedia.org'],
]

function Links({ t, userId }: { t: T; userId: string }) {
  const { links, add, remove, move } = useQuickLinks(userId)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { setErr(t('settings.invalidUrl')); return }
    const name = title.trim() || hostname(u)
    const error = await add(name, u)
    if (error) { setErr(error); return }
    setErr(''); setTitle(''); setUrl('')
  }

  const suggestions = SUGGESTED_LINKS.filter(([, u]) => !links.some((l) => hostname(l.url) === hostname(u)))

  return (
    <section className="card section" aria-labelledby="s-links">
      <h2 id="s-links">{t('links.title')}</h2>
      {links.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('links.empty')}</p>}
      <div>
        {links.map((l, i) => (
          <div className="toggle-row" key={l.id}>
            <img src={faviconFor(l.url)} alt="" width={24} height={24} style={{ borderRadius: 6 }} />
            <div className="grow">{l.title}<small>{l.url}</small></div>
            <button type="button" className="icon-btn" aria-label="↑" disabled={i === 0} onClick={() => move(l.id, -1)}>↑</button>
            <button type="button" className="icon-btn" aria-label="↓" disabled={i === links.length - 1} onClick={() => move(l.id, 1)}>↓</button>
            <button type="button" className="btn ghost" onClick={() => remove(l.id)}>{t('settings.remove')}</button>
          </div>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="field">
          <span>{t('links.suggest')}</span>
          <div className="seg">
            {suggestions.map(([n, u]) => <button key={u} type="button" onClick={() => add(n, u)}>+ {n}</button>)}
          </div>
        </div>
      )}
      <form className="field" onSubmit={submit}>
        <span>{t('links.add')}</span>
        <input className="input" type="url" inputMode="url" placeholder={t('links.url')} value={url} onChange={(e) => setUrl(e.target.value)} required />
        <input className="input" placeholder={t('links.name')} value={title} onChange={(e) => setTitle(e.target.value)} />
        {err && <div className="msg error">{err}</div>}
        <div><button className="btn primary" type="submit">{t('settings.add')}</button></div>
      </form>
    </section>
  )
}

function Segmented<V extends string>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

function Sources({ t, userId }: { t: T; userId: string }) {
  const [defaults, setDefaults] = useState<DefaultSource[]>([])
  const [mine, setMine] = useState<UserSource[]>([])
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('default_sources').select('*').order('sort_order').then(({ data }) => setDefaults((data as DefaultSource[]) ?? []))
    supabase.from('user_sources').select('*').eq('user_id', userId).order('sort_order').then(({ data }) => setMine((data as UserSource[]) ?? []))
  }, [userId])

  const isOn = (d: DefaultSource) => mine.find((m) => m.default_source_id === d.id)?.enabled ?? d.enabled_by_default

  async function toggleDefault(d: DefaultSource) {
    const next = !isOn(d)
    const existing = mine.find((m) => m.default_source_id === d.id)
    if (existing) {
      setMine((s) => s.map((m) => (m.id === existing.id ? { ...m, enabled: next } : m)))
      await supabase.from('user_sources').update({ enabled: next }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('user_sources').insert({ user_id: userId, default_source_id: d.id, enabled: next }).select().single()
      if (data) setMine((s) => [...s, data as UserSource])
    }
    sessionStorage.removeItem('homepage.feed')
  }

  async function addCustom(e: FormEvent) {
    e.preventDefault()
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { setErr(t('settings.invalidUrl')); return }
    setErr('')
    const { data, error } = await supabase.from('user_sources').insert({ user_id: userId, url: u, name: name.trim() || null, enabled: true }).select().single()
    if (error) { setErr(error.message); return }
    setMine((s) => [...s, data as UserSource]); setUrl(''); setName('')
    sessionStorage.removeItem('homepage.feed')
  }

  async function toggleCustom(m: UserSource) {
    setMine((s) => s.map((x) => (x.id === m.id ? { ...x, enabled: !m.enabled } : x)))
    await supabase.from('user_sources').update({ enabled: !m.enabled }).eq('id', m.id)
    sessionStorage.removeItem('homepage.feed')
  }

  async function remove(m: UserSource) {
    setMine((s) => s.filter((x) => x.id !== m.id))
    await supabase.from('user_sources').delete().eq('id', m.id)
    sessionStorage.removeItem('homepage.feed')
  }

  const custom = mine.filter((m) => !m.default_source_id)
  const categories = Array.from(new Set(defaults.map((d) => d.category)))

  return (
    <section className="card section" aria-labelledby="s-sources">
      <h2 id="s-sources">{t('settings.sources')}</h2>
      <p className="muted" style={{ margin: 0 }}>{t('settings.sourcesLead')}</p>
      {categories.map((c) => (
        <div key={c}>
          <div className="field"><span>{t(`category.${c}` as Key)}</span></div>
          {defaults.filter((d) => d.category === c).map((d) => (
            <div className="toggle-row" key={d.id}>
              <div className="grow">{d.name}<small>{hostname(d.url)}</small></div>
              <button type="button" role="switch" className="switch" aria-checked={isOn(d)} aria-label={d.name} onClick={() => toggleDefault(d)} />
            </div>
          ))}
        </div>
      ))}
      <div>
        <div className="field"><span>{t('settings.customSources')}</span></div>
        {custom.map((m) => (
          <div className="toggle-row" key={m.id}>
            <div className="grow">{m.name || hostname(m.url!)}<small>{m.url}</small></div>
            <button type="button" className="btn ghost" onClick={() => remove(m)}>{t('settings.remove')}</button>
            <button type="button" role="switch" className="switch" aria-checked={m.enabled} aria-label={m.name || m.url!} onClick={() => toggleCustom(m)} />
          </div>
        ))}
        <form className="field" onSubmit={addCustom} style={{ marginTop: 10 }}>
          <span>{t('settings.addSource')}</span>
          <input className="input" type="url" inputMode="url" placeholder={t('settings.sourceUrl')} value={url} onChange={(e) => setUrl(e.target.value)} required />
          <input className="input" placeholder={t('settings.sourceName')} value={name} onChange={(e) => setName(e.target.value)} />
          {err && <div className="msg error">{err}</div>}
          <div><button className="btn primary" type="submit">{t('settings.add')}</button></div>
        </form>
      </div>
    </section>
  )
}

type Geo = { id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string }

function Weather({ t, profile, update }: { t: T; profile: Profile; update: Props['update'] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Geo[] | null>(null)

  async function search(e: FormEvent) {
    e.preventDefault()
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=${profile.language}&format=json`)
    const json = await res.json()
    setResults((json.results as Geo[]) ?? [])
  }

  return (
    <section className="card section" aria-labelledby="s-weather">
      <h2 id="s-weather">{t('settings.weather')}</h2>
      <p className="muted" style={{ margin: 0 }}>{t('settings.weatherLead')}</p>
      {profile.weather_city && (
        <div className="row">
          <span>📍 {profile.weather_city}</span>
          <button type="button" className="btn ghost" onClick={() => update({ weather_city: null, weather_lat: null, weather_lon: null })}>{t('settings.weatherClear')}</button>
        </div>
      )}
      <form className="row" onSubmit={search}>
        <input className="input" style={{ flex: 1 }} placeholder={t('settings.weatherCity')} value={q} onChange={(e) => setQ(e.target.value)} required />
        <button className="btn" type="submit">{t('settings.weatherSearch')}</button>
      </form>
      {results && results.length === 0 && <p className="muted">{t('settings.weatherNone')}</p>}
      {results && results.length > 0 && (
        <div className="results">
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => { update({ weather_city: r.name, weather_lat: r.latitude, weather_lon: r.longitude }); setResults(null); setQ('') }}>
              {r.name}{r.admin1 ? `, ${r.admin1}` : ''}{r.country ? ` · ${r.country}` : ''}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
