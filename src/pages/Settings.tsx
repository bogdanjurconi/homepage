import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Key, T } from '../lib/i18n'
import {
  ACCENTS, BACKGROUNDS, CATEGORY_ORDER, FONTS, LAYOUTS, SEARCH_ENGINES, TEXT_SIZES,
  type Accent, type Account, type Category, type DefaultSource, type Layout, type Profile, type SearchEngine, type TextSize, type Theme, type UserSource,
} from '../lib/types'
import { hostname, timeAgo } from '../lib/time'
import { useQuickLinks } from '../hooks/useQuickLinks'
import { CURRENCIES } from '../lib/types'
import { faviconFor } from '../components/QuickLinks'
import { StarIcon, BookIcon } from '../components/Icons'

type Props = { t: T; profile: Profile; update: (p: Partial<Omit<Profile, 'id'>>) => Promise<void>; saving: boolean; userId: string; email: string }

const ACCENT_HEX: Record<Accent, string> = { blue: '#2f6bea', teal: '#0e8577', green: '#2f8f5b', amber: '#b9740f', coral: '#d9553d', violet: '#7557d6' }

type SectionId = 'profile' | 'look' | 'front' | 'links' | 'sources' | 'weather' | 'account' | 'invites'
const SECTIONS: { id: SectionId; key: Key }[] = [
  { id: 'profile', key: 'settings.profile' }, { id: 'look', key: 'settings.appearance' }, { id: 'front', key: 'settings.frontPage' },
  { id: 'links', key: 'links.title' }, { id: 'sources', key: 'settings.sources' }, { id: 'weather', key: 'settings.weather' }, { id: 'account', key: 'settings.account' },
  { id: 'invites', key: 'invites.title' },
]

export default function Settings({ t, profile, update, saving, userId, email }: Props) {
  const [active, setActive] = useState<SectionId>('profile')
  const refs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActive(visible.target.id as SectionId)
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 })
    Object.values(refs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const jump = (id: SectionId) => { setActive(id); refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const reg = (id: SectionId) => (el: HTMLElement | null) => { refs.current[id] = el }

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t('settings.title')}>
        {SECTIONS.filter((s) => s.id !== 'invites' || profile.is_admin).map((s) => (
          <button key={s.id} type="button" aria-current={active === s.id} onClick={() => jump(s.id)}>{t(s.key)}</button>
        ))}
      </nav>

      <div className="settings-main">
        <div className="row">
          <h1 style={{ margin: 0 }}>{t('settings.title')}</h1>
          <span className="status" aria-live="polite">{saving ? t('settings.saving') : ''}</span>
        </div>

        <Section id="profile" ref={reg('profile')} title={t('settings.profile')} desc={t('settings.profileDesc')}>
          <ProfileFields t={t} profile={profile} update={update} />
        </Section>

        <Section id="look" ref={reg('look')} title={t('settings.appearance')} desc={t('settings.appearanceDesc')}>
          <div className="look-grid">
            <div className="stack">
              <Field label={t('settings.theme')}>
                <Segmented<Theme> value={profile.theme} options={[['auto', t('theme.auto')], ['light', t('theme.light')], ['dark', t('theme.dark')]]} onChange={(v) => update({ theme: v })} />
              </Field>
              <Field label={t('settings.accent')}>
                <div className="swatches" role="radiogroup" aria-label={t('settings.accent')}>
                  {ACCENTS.map((a) => (
                    <button key={a} type="button" className="swatch" style={{ background: ACCENT_HEX[a] }} aria-pressed={profile.accent === a}
                      aria-label={t(`accent.${a}` as Key)} title={t(`accent.${a}` as Key)} onClick={() => update({ accent: a })} />
                  ))}
                </div>
              </Field>
              <Field label={t('settings.layout')}>
                <div className="option-cards">
                  {LAYOUTS.map((l) => (
                    <button key={l} type="button" className="option-card" aria-pressed={profile.layout === l} onClick={() => update({ layout: l })}>
                      <LayoutGlyph layout={l} /><span>{t(`layout.${l}` as Key)}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Toggle label={t('settings.showSummary')} on={profile.show_summary} onChange={(v) => update({ show_summary: v })} />
              <Field label={t('settings.font')}>
                <div className="option-cards">
                  {FONTS.map((f) => (
                    <button key={f} type="button" className="option-card" aria-pressed={profile.font === f} data-font={f} onClick={() => update({ font: f })}>
                      <span className="font-glyph">Aa</span><span>{t(`font.${f}` as Key)}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('settings.background')}>
                <div className="option-cards">
                  {BACKGROUNDS.map((b) => (
                    <button key={b} type="button" className="option-card" aria-pressed={profile.background === b} onClick={() => update({ background: b })}>
                      <span className={`bg-glyph bg-${b}`} aria-hidden="true" /><span>{t(`bg.${b}` as Key)}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('settings.textSize')}>
                <Segmented<TextSize> value={profile.text_size} options={TEXT_SIZES.map((s) => [s, t(`size.${s}` as Key)] as [TextSize, string])} onChange={(v) => update({ text_size: v })} />
              </Field>
            </div>
            <aside className="look-preview" aria-label={t('settings.preview')}>
              <small className="muted">{t('settings.preview')}</small>
              <Preview t={t} layout={profile.layout} showSummary={profile.show_summary} />
            </aside>
          </div>
        </Section>

        <Section id="front" ref={reg('front')} title={t('settings.frontPage')} desc={t('settings.frontPageDesc')}>
          <Toggle label={t('settings.showRates')} on={profile.show_rates} onChange={(v) => update({ show_rates: v })} />
          {profile.show_rates && (
            <Field label={t('settings.rateCurrencies')}>
              <div className="seg seg-small">
                {CURRENCIES.map((c) => {
                  const on = profile.rate_currencies.includes(c)
                  return (
                    <button key={c} type="button" aria-pressed={on} disabled={on && profile.rate_currencies.length === 1}
                      onClick={() => update({ rate_currencies: on ? profile.rate_currencies.filter((x) => x !== c) : [...CURRENCIES].filter((x) => x === c || profile.rate_currencies.includes(x)) })}>
                      {c}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}
          <Toggle label={t('settings.showCalendar')} on={profile.show_calendar} onChange={(v) => update({ show_calendar: v })} />
          <Toggle label={t('settings.openInReader')} on={profile.open_in_reader} onChange={(v) => update({ open_in_reader: v })} />
          <Field label={t('settings.searchEngine')}>
            <Segmented<SearchEngine> value={profile.search_engine} options={SEARCH_ENGINES.map((e) => [e, t(`engine.${e}` as Key)] as [SearchEngine, string])} onChange={(v) => update({ search_engine: v })} />
          </Field>
        </Section>

        <Section id="links" ref={reg('links')} title={t('links.title')} desc={t('settings.linksDesc')}>
          <Links t={t} userId={userId} />
        </Section>

        <Section id="sources" ref={reg('sources')} title={t('settings.sources')} desc={t('settings.sourcesLead')}>
          <Sources t={t} userId={userId} />
        </Section>

        <Section id="weather" ref={reg('weather')} title={t('settings.weather')} desc={t('settings.weatherDesc')}>
          <Weather t={t} profile={profile} update={update} />
        </Section>

        <Section id="account" ref={reg('account')} title={t('settings.account')} desc={t('settings.signedInAs', { email })}>
          <div className="two-col">
            <PasswordForm t={t} email={email} hasPassword={profile.has_password} onSet={() => update({ has_password: true })} />
            <div className="stack" style={{ justifyItems: 'start' }}>
              <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>{t('settings.signOut')}</button>
            </div>
          </div>
        </Section>

        {profile.is_admin && (
          <Section id="invites" ref={reg('invites')} title={t('invites.title')} desc={t('invites.desc')}>
            <Invites t={t} lang={profile.language} selfId={userId} />
          </Section>
        )}
      </div>
    </div>
  )
}

/* ---------- building blocks ---------- */

function Section({ id, title, desc, children, ref }: { id: string; title: string; desc?: string; children: ReactNode; ref: (el: HTMLElement | null) => void }) {
  return (
    <section id={id} ref={ref} className="card section" aria-labelledby={`h-${id}`}>
      <div className="section-head">
        <h2 id={`h-${id}`}>{title}</h2>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><span>{label}</span>{children}</div>
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

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="toggle-row">
      <div className="grow">{label}{hint && <small>{hint}</small>}</div>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  )
}

function LayoutGlyph({ layout }: { layout: Layout }) {
  return (
    <svg className="layout-glyph" viewBox="0 0 48 36" aria-hidden="true">
      {layout === 'cards' && <>
        <rect x="2" y="2" width="21" height="14" rx="2" /><rect x="25" y="2" width="21" height="14" rx="2" />
        <rect x="2" y="20" width="21" height="14" rx="2" /><rect x="25" y="20" width="21" height="14" rx="2" />
      </>}
      {layout === 'magazine' && <>
        <rect x="2" y="2" width="44" height="18" rx="2" />
        <rect x="2" y="24" width="13" height="10" rx="2" /><rect x="17.5" y="24" width="13" height="10" rx="2" /><rect x="33" y="24" width="13" height="10" rx="2" />
      </>}
      {layout === 'list' && <>
        <rect x="2" y="2" width="9" height="9" rx="2" /><rect x="14" y="4" width="32" height="5" rx="1.5" />
        <rect x="2" y="14" width="9" height="9" rx="2" /><rect x="14" y="16" width="32" height="5" rx="1.5" />
        <rect x="2" y="26" width="9" height="9" rx="2" /><rect x="14" y="28" width="32" height="5" rx="1.5" />
      </>}
    </svg>
  )
}

function Preview({ t, layout, showSummary }: { t: T; layout: Layout; showSummary: boolean }) {
  return (
    <div className={layout === 'list' ? 'list preview' : 'grid preview'}>
      <article className="card article">
        {layout !== 'list' && <div className="article-img preview-img" aria-hidden="true" />}
        <div className="article-body">
          <h3 className="article-title">{t('settings.previewTitle')}</h3>
          {showSummary && <p className="article-sum">{t('settings.previewSummary')}</p>}
          <div className="article-foot">
            <div className="article-src"><b>{t('settings.previewSource')}</b><span>·</span><span>{t('time.now')}</span></div>
            <div className="article-actions">
              <span className="icon-btn"><BookIcon /></span>
              <span className="icon-btn" aria-pressed="true"><StarIcon filled /></span>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

/* ---------- sections ---------- */

function ProfileFields({ t, profile, update }: { t: T; profile: Profile; update: Props['update'] }) {
  const [name, setName] = useState(profile.display_name ?? '')
  useEffect(() => setName(profile.display_name ?? ''), [profile.display_name])
  return (
    <div className="two-col">
      <label className="field">
        <span>{t('settings.name')}</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== (profile.display_name ?? '') && update({ display_name: name.trim() || null })} />
      </label>
      <Field label={t('settings.language')}>
        <Segmented value={profile.language} options={[['en', 'English'], ['ro', 'Română']]} onChange={(v) => update({ language: v })} />
      </Field>
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
    const error = await add(title.trim() || hostname(u), u)
    if (error) { setErr(error); return }
    setErr(''); setTitle(''); setUrl('')
  }

  const suggestions = SUGGESTED_LINKS.filter(([, u]) => !links.some((l) => hostname(l.url) === hostname(u)))

  return (
    <div className="two-col">
      <div className="stack">
        {links.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('links.empty')}</p>}
        <div className="src-grid">
          {links.map((l, i) => (
            <div className="src-card" key={l.id} data-on="true">
              <img className="src-icon" src={faviconFor(l.url)} alt="" width={28} height={28} />
              <div className="grow"><b>{l.title}</b><small>{hostname(l.url)}</small></div>
              <button type="button" className="icon-btn" aria-label="↑" disabled={i === 0} onClick={() => move(l.id, -1)}>↑</button>
              <button type="button" className="icon-btn" aria-label="↓" disabled={i === links.length - 1} onClick={() => move(l.id, 1)}>↓</button>
              <button type="button" className="icon-btn" aria-label={t('settings.remove')} title={t('settings.remove')} onClick={() => remove(l.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="stack">
        {suggestions.length > 0 && (
          <Field label={t('links.suggest')}>
            <div className="seg">
              {suggestions.map(([n, u]) => <button key={u} type="button" onClick={() => add(n, u)}>+ {n}</button>)}
            </div>
          </Field>
        )}
        <form className="field" onSubmit={submit}>
          <span>{t('links.add')}</span>
          <input className="input" type="url" inputMode="url" placeholder={t('links.url')} value={url} onChange={(e) => setUrl(e.target.value)} required />
          <input className="input" placeholder={t('links.name')} value={title} onChange={(e) => setTitle(e.target.value)} />
          {err && <div className="msg error">{err}</div>}
          <div><button className="btn primary" type="submit">{t('settings.add')}</button></div>
        </form>
      </div>
    </div>
  )
}

type LangFilter = 'all' | 'ro' | 'en'

function Sources({ t, userId }: { t: T; userId: string }) {
  const [defaults, setDefaults] = useState<DefaultSource[]>([])
  const [mine, setMine] = useState<UserSource[]>([])
  const [section, setSection] = useState<Category | 'all'>('all')
  const [lang, setLang] = useState<LangFilter>('all')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('default_sources').select('*').order('sort_order').then(({ data }) => setDefaults((data as DefaultSource[]) ?? []))
    supabase.from('user_sources').select('*').eq('user_id', userId).order('sort_order').then(({ data }) => setMine((data as UserSource[]) ?? []))
  }, [userId])

  const isOn = (d: DefaultSource) => mine.find((m) => m.default_source_id === d.id)?.enabled ?? d.enabled_by_default
  const invalidate = () => sessionStorage.removeItem('homepage.feed')

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
    invalidate()
  }

  async function addCustom(e: FormEvent) {
    e.preventDefault()
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { setErr(t('settings.invalidUrl')); return }
    setErr('')
    const { data, error } = await supabase.from('user_sources').insert({ user_id: userId, url: u, name: name.trim() || null, enabled: true }).select().single()
    if (error) { setErr(error.message); return }
    setMine((s) => [...s, data as UserSource]); setUrl(''); setName(''); invalidate()
  }

  async function toggleCustom(m: UserSource) {
    setMine((s) => s.map((x) => (x.id === m.id ? { ...x, enabled: !m.enabled } : x)))
    await supabase.from('user_sources').update({ enabled: !m.enabled }).eq('id', m.id)
    invalidate()
  }

  async function remove(m: UserSource) {
    setMine((s) => s.filter((x) => x.id !== m.id))
    await supabase.from('user_sources').delete().eq('id', m.id)
    invalidate()
  }

  const custom = mine.filter((m) => !m.default_source_id)
  const sections = useMemo(() => CATEGORY_ORDER.filter((c) => c === 'custom' ? custom.length > 0 : defaults.some((d) => d.category === c)), [defaults, custom.length])
  const shown = defaults.filter((d) => (section === 'all' || d.category === section) && (lang === 'all' || d.language === lang))
  const showCustom = (section === 'all' || section === 'custom') && custom.length > 0
  const activeCount = defaults.filter(isOn).length + custom.filter((m) => m.enabled).length

  return (
    <div className="stack">
      <div className="filter-row">
        <div className="chips" role="group" aria-label={t('settings.sources')}>
          <button type="button" className="chip" aria-pressed={section === 'all'} onClick={() => setSection('all')}>{t('feed.all')}</button>
          {sections.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={section === c} onClick={() => setSection(c)}>{t(`category.${c}` as Key)}</button>
          ))}
        </div>
        <div className="seg seg-small" role="group" aria-label={t('lang.all')}>
          {(['all', 'ro', 'en'] as LangFilter[]).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l === 'all' ? t('lang.all') : l.toUpperCase()}</button>
          ))}
        </div>
        <span className="muted" style={{ marginLeft: 'auto' }}>{t('settings.activeSources', { n: activeCount })}</span>
      </div>

      {shown.length === 0 && !showCustom && <p className="muted" style={{ margin: 0 }}>{t('settings.noSources')}</p>}

      <div className="src-grid">
        {shown.map((d) => (
          <div className="src-card" key={d.id} data-on={isOn(d)}>
            <img className="src-icon" src={faviconFor(d.site_url ?? d.url)} alt="" width={28} height={28} loading="lazy" />
            <div className="grow">
              <b>{d.name}</b>
              <small>{hostname(d.site_url ?? d.url)} · {t(`category.${d.category}` as Key)}</small>
            </div>
            <span className={`lang-badge lang-${d.language}`}>{d.language.toUpperCase()}</span>
            <button type="button" role="switch" className="switch" aria-checked={isOn(d)} aria-label={d.name} onClick={() => toggleDefault(d)} />
          </div>
        ))}
        {showCustom && custom.map((m) => (
          <div className="src-card" key={m.id} data-on={m.enabled}>
            <img className="src-icon" src={faviconFor(m.url!)} alt="" width={28} height={28} loading="lazy" />
            <div className="grow"><b>{m.name || hostname(m.url!)}</b><small>{m.url}</small></div>
            <button type="button" className="icon-btn" aria-label={t('settings.remove')} title={t('settings.remove')} onClick={() => remove(m)}>✕</button>
            <button type="button" role="switch" className="switch" aria-checked={m.enabled} aria-label={m.name || m.url!} onClick={() => toggleCustom(m)} />
          </div>
        ))}
      </div>

      <form className="field add-source" onSubmit={addCustom}>
        <span>{t('settings.addSource')}</span>
        <div className="row">
          <input className="input" style={{ flex: '2 1 240px' }} type="url" inputMode="url" placeholder={t('settings.sourceUrl')} value={url} onChange={(e) => setUrl(e.target.value)} required />
          <input className="input" style={{ flex: '1 1 160px' }} placeholder={t('settings.sourceName')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" type="submit">{t('settings.add')}</button>
        </div>
        {err && <div className="msg error">{err}</div>}
      </form>
    </div>
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
    <div className="two-col">
      <div className="stack">
        {profile.weather_city ? (
          <div className="src-card" data-on="true">
            <span className="src-icon" aria-hidden="true">📍</span>
            <div className="grow"><b>{profile.weather_city}</b><small>{profile.weather_lat?.toFixed(2)}, {profile.weather_lon?.toFixed(2)}</small></div>
            <button type="button" className="btn ghost" onClick={() => update({ weather_city: null, weather_lat: null, weather_lon: null })}>{t('settings.weatherClear')}</button>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>{t('settings.weatherLead')}</p>}
      </div>
      <div className="stack">
        <form className="row" onSubmit={search}>
          <input className="input" style={{ flex: 1 }} placeholder={t('settings.weatherCity')} value={q} onChange={(e) => setQ(e.target.value)} required />
          <button className="btn" type="submit">{t('settings.weatherSearch')}</button>
        </form>
        {results && results.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('settings.weatherNone')}</p>}
        {results && results.length > 0 && (
          <div className="results">
            {results.map((r) => (
              <button key={r.id} type="button" onClick={() => { update({ weather_city: r.name, weather_lat: r.latitude, weather_lon: r.longitude }); setResults(null); setQ('') }}>
                {r.name}{r.admin1 ? `, ${r.admin1}` : ''}{r.country ? ` · ${r.country}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PasswordForm({ t, email, hasPassword, onSet }: { t: T; email: string; hasPassword: boolean; onSet: () => void }) {
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw !== pw2) { setMsg({ ok: false, text: t('account.passwordMismatch') }); return }
    setBusy(true); setMsg(null)
    if (hasPassword) {
      // Re-authenticate with the current password before changing it.
      const { error } = await supabase.auth.signInWithPassword({ email, password: current })
      if (error) { setBusy(false); setMsg({ ok: false, text: t('account.wrongCurrent') }); return }
    }
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setMsg({ ok: true, text: t('account.passwordSaved') }); setCurrent(''); setPw(''); setPw2('')
    if (!hasPassword) onSet()
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div>
        <b>{hasPassword ? t('account.changePassword') : t('account.setPassword')}</b>
        <div className="muted" style={{ fontSize: '.92em' }}>{hasPassword ? t('account.hasPassword') : t('account.setPasswordDesc')}</div>
      </div>
      {hasPassword && (
        <input className="input" type="password" autoComplete="current-password" required placeholder={t('account.currentPassword')} value={current} onChange={(e) => setCurrent(e.target.value)} />
      )}
      <input className="input" type="password" autoComplete="new-password" minLength={8} required placeholder={t('account.newPassword')} value={pw} onChange={(e) => setPw(e.target.value)} />
      <input className="input" type="password" autoComplete="new-password" minLength={8} required placeholder={t('account.confirmPassword')} value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {msg && <div className={`msg ${msg.ok ? '' : 'error'}`}>{msg.text}</div>}
      <div><button className="btn primary" type="submit" disabled={busy || pw.length < 8 || (hasPassword && !current)}>{t('account.save')}</button></div>
    </form>
  )
}

function Invites({ t, lang, selfId }: { t: T; lang: Profile['language']; selfId: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  type Resp = { accounts?: Account[]; error?: string; code?: string | null }
  async function call(body: Record<string, unknown>): Promise<Resp> {
    const { data, error } = await supabase.functions.invoke<Resp>('admin', { body })
    if (error) {
      // FunctionsHttpError carries the JSON body of a non-2xx response.
      const ctx = (error as { context?: Response }).context
      try { return (await ctx?.json()) ?? { error: error.message } } catch { return { error: error.message } }
    }
    return data ?? {}
  }

  useEffect(() => { call({ action: 'list' }).then((r) => setAccounts(r.accounts ?? [])) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await call({ action: 'invite', email: email.trim() })
    setBusy(false)
    if (r.error) {
      const known = r.error === 'invalid_email' ? t('invites.error.invalid_email') : /already|exists|registered/i.test(r.error) ? t('invites.error.exists') : r.error
      setMsg({ ok: false, text: known }); return
    }
    setMsg({ ok: true, text: t('invites.sent') }); setEmail(''); if (r.accounts) setAccounts(r.accounts)
  }

  async function remove(a: Account) {
    if (!window.confirm(t('invites.confirmRemove', { email: a.email }))) return
    const r = await call({ action: 'remove', user_id: a.id })
    if (r.error) { setMsg({ ok: false, text: r.error }); return }
    if (r.accounts) setAccounts(r.accounts)
  }

  return (
    <div className="two-col">
      <form className="stack" onSubmit={invite}>
        <label className="field">
          <span>{t('invites.email')}</span>
          <input className="input" type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {msg && <div className={`msg ${msg.ok ? '' : 'error'}`}>{msg.text}</div>}
        <div><button className="btn primary" type="submit" disabled={busy || !email}>{t('invites.send')}</button></div>
      </form>
      <div className="stack">
        <Field label={t('invites.accounts')}>
          <div className="stack" style={{ gap: 8 }}>
            {accounts === null && <span className="muted">…</span>}
            {accounts?.map((a) => (
              <div className="src-card" key={a.id} data-on={a.status === 'active'}>
                <div className="grow">
                  <b>{a.display_name || a.email}</b>
                  <small>{a.email}{a.last_sign_in_at ? ` · ${t('invites.lastSeen', { time: timeAgo(a.last_sign_in_at, lang, t('time.now')) })}` : ''}</small>
                </div>
                <span className="lang-badge">{a.is_admin ? t('invites.admin') : t(`invites.status.${a.status}` as Key)}</span>
                {!a.is_admin && a.id !== selfId && (
                  <button type="button" className="icon-btn" aria-label={t('invites.remove')} title={t('invites.remove')} onClick={() => remove(a)}>✕</button>
                )}
              </div>
            ))}
          </div>
        </Field>
      </div>
    </div>
  )
}
