import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { customAccentVars, isCustomAccent } from '../lib/accent'
import { supabase } from '../lib/supabase'
import type { Key, T } from '../lib/i18n'
import {
  ACCENTS, BACKGROUNDS, CATEGORY_ORDER, FONTS, LAYOUTS, SEARCH_ENGINES, TEXT_SIZES,
  type Account, type Category, type DefaultSource, type Layout, type Profile, type SearchEngine, type TextSize, type Theme, type UserSource,
} from '../lib/types'
import { hostname, timeAgo } from '../lib/time'
import { useQuickLinks } from '../hooks/useQuickLinks'
import { CURRENCIES, MAX_TEAMS, type SportTeamOption, type Team } from '../lib/types'
import { faviconFor } from '../components/QuickLinks'
import { StarIcon, BookIcon } from '../components/Icons'
import WeatherIcon from '../components/WeatherIcon'

type Props = { t: T; profile: Profile; update: (p: Partial<Omit<Profile, 'id'>>) => Promise<void>; saving: boolean; saveError?: boolean; userId: string; email: string }

// Accepts a bare domain ('digi24.ro') and returns it as a full https:// address, or null when it is not a web address.
function normalizeUrl(raw: string): string | null {
  const s = raw.trim()
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? withScheme : null
  } catch { return null }
}

type SectionId = 'profile' | 'look' | 'front' | 'links' | 'sources' | 'weather' | 'sport' | 'account' | 'invites'
const SECTIONS: { id: SectionId; key: Key }[] = [
  { id: 'profile', key: 'settings.profile' }, { id: 'look', key: 'settings.appearance' }, { id: 'front', key: 'settings.frontPage' },
  { id: 'links', key: 'links.title' }, { id: 'sources', key: 'settings.sources' }, { id: 'weather', key: 'settings.weather' }, { id: 'sport', key: 'settings.sport' }, { id: 'account', key: 'settings.account' },
  { id: 'invites', key: 'invites.title' },
]

export default function Settings({ t, profile, update: persist, saving, saveError, userId, email }: Props) {
  const [active, setActive] = useState<SectionId>('profile')
  const refs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})

  useEffect(() => {
    // Track every section in view (the callback only receives the ones that changed) and highlight the topmost.
    const seen = new Set<SectionId>()
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const id = e.target.id as SectionId; if (e.isIntersecting) seen.add(id); else seen.delete(id) })
      const first = SECTIONS.find((s) => seen.has(s.id))
      if (first) setActive(first.id)
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 })
    Object.values(refs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  // "Saved" flashes briefly after each save finishes (the profile hook only exposes `saving`).
  const [savedFlash, setSavedFlash] = useState(false)
  const flashTimer = useRef(0)
  const update = useCallback(async (p: Partial<Omit<Profile, 'id'>>) => {
    await persist(p)
    setSavedFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1500)
  }, [persist])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

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
          <span className="status" aria-live="polite">{saving ? t('settings.saving') : saveError ? t('error.generic') : savedFlash ? t('settings.saved') : ''}</span>
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
                <div className="swatches" role="group" aria-label={t('settings.accent')}>
                  {ACCENTS.map((a) => (
                    <button key={a} type="button" className="swatch" data-accent={a} aria-pressed={profile.accent === a}
                      aria-label={t(`accent.${a}` as Key)} title={t(`accent.${a}` as Key)} onClick={() => update({ accent: a })} />
                  ))}
                  <CustomSwatch t={t} accent={profile.accent} saved={profile.accent_custom} onPick={(hex) => update({ accent: hex as `#${string}`, accent_custom: hex })} />
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
              {/* the compact list never shows summaries: the switch reads off and rests, the saved choice is kept for the other layouts */}
              <Toggle label={t('settings.showSummary')} on={profile.show_summary && profile.layout !== 'list'} disabled={profile.layout === 'list'} onChange={(v) => update({ show_summary: v })} />
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
          <Toggle label={t('settings.showSearch')} on={profile.show_search} onChange={(v) => update({ show_search: v })} />
          {profile.show_search && (
            <Field label={t('settings.searchEngine')}>
              <Segmented<SearchEngine> value={profile.search_engine} options={SEARCH_ENGINES.map((e) => [e, t(`engine.${e}` as Key)] as [SearchEngine, string])} onChange={(v) => update({ search_engine: v })} />
            </Field>
          )}
          <Toggle label={t('settings.openInReader')} on={profile.open_in_reader} onChange={(v) => update({ open_in_reader: v })} />
        </Section>

        {/* Each section's description is one paragraph: what it does, then how to use it. */}
        <Section id="links" ref={reg('links')} title={t('links.title')} desc={`${t('settings.linksDesc')} ${t('links.empty')}`}>
          <Links t={t} userId={userId} />
        </Section>

        <Section id="sources" ref={reg('sources')} title={t('settings.sources')} desc={t('settings.sourcesLead')}>
          <Sources t={t} userId={userId} />
        </Section>

        <Section id="weather" ref={reg('weather')} title={t('settings.weather')} desc={`${t('settings.weatherDesc')} ${t('settings.weatherLead')}`}>
          <Weather t={t} profile={profile} update={update} />
        </Section>

        <Section id="sport" ref={reg('sport')} title={t('settings.sport')} desc={`${t('settings.sportDesc')} ${t('settings.sportLead')}`}>
          <SportTeams t={t} teams={profile.teams} onChange={(teams) => update({ teams })} />
        </Section>

        <Section id="account" ref={reg('account')} title={t('settings.account')} desc={t('settings.signedInAs', { email })}>
          <div className="two-col">
            <PasswordForm t={t} email={email} hasPassword={profile.has_password} onSet={() => update({ has_password: true })} />
            <div className="stack account-actions">
              {/* Per-tab caches (feed, links, weather…) carry no user id, so clear them for the next account on a shared device. */}
              <button type="button" className="btn" onClick={() => { sessionStorage.clear(); void supabase.auth.signOut() }}>{t('settings.signOut')}</button>
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

// The last swatch holds the person's own colour. While a preset is chosen, a tap brings that colour
// back; once it is the chosen one, a tap opens the system colour picker to change it. Dragging in the
// picker fires many changes: the page follows each one at once, and only the colour it settles on is saved.
function CustomSwatch({ t, accent, saved, onPick }: { t: T; accent: string; saved: string | null; onPick: (hex: string) => void }) {
  const active = isCustomAccent(accent)
  const [live, setLive] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const shown = live ?? (active ? accent : saved)
  const style = shown ? ({ '--picked': shown } as React.CSSProperties) : undefined
  const pick = (hex: string) => {
    setLive(hex)
    const root = document.documentElement
    const vars = customAccentVars(hex, root.dataset.theme === 'dark')
    root.dataset.accent = 'custom'
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { onPick(hex); setLive(null) }, 500)
  }
  if (!active && live == null && saved) return (
    <button type="button" className="swatch custom" aria-pressed={false} aria-label={t('accent.custom')} title={t('accent.custom')} style={style} onClick={() => onPick(saved)} />
  )
  return (
    <label className={`swatch custom${active || live != null ? ' on' : ''}`} title={t('accent.custom')} style={style}>
      <input type="color" className="visually-hidden" aria-label={t('accent.custom')} value={shown ?? '#24518f'} onChange={(e) => pick(e.target.value)} />
    </label>
  )
}

function Toggle({ label, on, onChange, hint, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="toggle-row" aria-disabled={disabled || undefined} onClick={() => { if (!disabled) onChange(!on) }}>
      <div className="grow">{label}{hint && <small>{hint}</small>}</div>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={(e) => { e.stopPropagation(); onChange(!on) }} />
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

// A small news page in the chosen layout, drawn at a desktop-like width and zoomed to fit the column, so cards, magazine and list look as they will on the front page.
const PREVIEW_WIDTH = 640
const PREVIEW_ITEMS: { title: Key; summary: Key; source: string; hue: number }[] = [
  { title: 'settings.previewTitle', summary: 'settings.previewSummary', source: 'Digi24', hue: 0 },
  { title: 'settings.previewTitle2', summary: 'settings.previewSummary2', source: 'HotNews', hue: 1 },
  { title: 'settings.previewTitle3', summary: 'settings.previewSummary3', source: 'Ars Technica', hue: 2 },
  { title: 'settings.previewTitle4', summary: 'settings.previewSummary4', source: 'GSMArena', hue: 3 },
]

function Preview({ t, layout, showSummary }: { t: T; layout: Layout; showSummary: boolean }) {
  const frame = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const fit = () => setZoom(Math.min(1, el.clientWidth / PREVIEW_WIDTH))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cls = layout === 'list' ? 'list' : layout === 'magazine' ? 'magazine' : 'grid'
  const src = (item: typeof PREVIEW_ITEMS[number]) => <div className="article-src"><b>{item.source}</b><span>·</span><span>{t('time.now')}</span></div>
  const actions = (i: number) => (
    <div className="article-actions">
      <span className="icon-btn"><BookIcon /></span>
      <span className="icon-btn" aria-pressed={i === 0 ? 'true' : undefined}><StarIcon filled={i === 0} /></span>
    </div>
  )
  return (
    <div className="preview-frame" ref={frame}>
      <div className={`${cls} preview`} style={zoom < 1 ? { width: PREVIEW_WIDTH, zoom } : undefined}>
        {PREVIEW_ITEMS.map((item, i) => (
          <article key={item.title} className={`card article${layout === 'magazine' && i === 0 ? ' lead' : ''}`}>
            {layout === 'list'
              ? <div className="article-media"><div className="article-img preview-img" data-hue={item.hue} aria-hidden="true" />{src(item)}{actions(i)}</div>
              : <div className="article-img preview-img" data-hue={item.hue} aria-hidden="true" />}
            <div className="article-body">
              <h3 className="article-title">{t(item.title)}</h3>
              {showSummary && <p className="article-sum">{t(item.summary)}</p>}
              <div className="article-foot">{src(item)}{actions(i)}</div>
            </div>
          </article>
        ))}
      </div>
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
        <input className="input" value={name} autoComplete="name" enterKeyHint="done" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
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
  const [busy, setBusy] = useState(false)

  // The hook returns the raw database message; show plain words instead.
  const friendly = (error: string | null) => (error ? t(/duplicate|unique|exists/i.test(error) ? 'links.exists' : 'error.generic') : '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const u = normalizeUrl(url)
    if (!u) { setErr(t('settings.invalidUrl')); return }
    setBusy(true)
    try {
      const error = await add(title.trim() || hostname(u), u)
      setErr(friendly(error))
      if (!error) { setTitle(''); setUrl('') }
    } finally { setBusy(false) }
  }

  async function suggest(n: string, u: string) {
    setBusy(true)
    try { setErr(friendly(await add(n, u))) } finally { setBusy(false) }
  }

  const suggestions = SUGGESTED_LINKS.filter(([, u]) => !links.some((l) => hostname(l.url) === hostname(u)))

  // One column across the section: the links as a grid of cards, the suggestions on one line, the form on one row.
  return (
    <div className="stack">
      {links.length > 0 && (
        <div className="src-grid">
          {links.map((l, i) => (
            <div className="src-card" key={l.id}>
              <img className="src-icon" src={faviconFor(l.url)} alt="" width={28} height={28} />
              <div className="grow"><b>{l.title}</b><small>{hostname(l.url)}</small></div>
              <button type="button" className="icon-btn" aria-label={t('links.moveUp')} title={t('links.moveUp')} disabled={i === 0} onClick={() => move(l.id, -1)}>↑</button>
              <button type="button" className="icon-btn" aria-label={t('links.moveDown')} title={t('links.moveDown')} disabled={i === links.length - 1} onClick={() => move(l.id, 1)}>↓</button>
              <button type="button" className="icon-btn" aria-label={t('settings.remove')} title={t('settings.remove')} onClick={() => remove(l.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <Field label={t('links.suggest')}>
          <div className="seg seg-small">
            {suggestions.map(([n, u]) => <button key={u} type="button" disabled={busy} onClick={() => suggest(n, u)}>+ {n}</button>)}
          </div>
        </Field>
      )}
      <form className="field add-source add-link" onSubmit={submit}>
        <span>{t('links.add')}</span>
        <div className="row">
          <input className="input link-url" type="text" inputMode="url" autoComplete="off" enterKeyHint="done" aria-label={t('links.url')} placeholder={t('links.url')} value={url} onChange={(e) => setUrl(e.target.value)} required />
          <input className="input link-name" autoComplete="off" aria-label={t('links.name')} placeholder={t('links.name')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy}>{t('settings.add')}</button>
        </div>
        {err && <div className="msg error">{err}</div>}
      </form>
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
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('default_sources').select('*').order('sort_order').then(({ data }) => setDefaults((data as DefaultSource[]) ?? []))
    supabase.from('user_sources').select('*').eq('user_id', userId).order('sort_order').then(({ data }) => setMine((data as UserSource[]) ?? []))
  }, [userId])

  const isOn = (d: DefaultSource) => mine.find((m) => m.default_source_id === d.id)?.enabled ?? d.enabled_by_default
  const invalidate = () => sessionStorage.removeItem('homepage.feed')

  async function toggleDefault(d: DefaultSource) {
    const next = !isOn(d)
    const existing = mine.find((m) => m.default_source_id === d.id)
    if (existing?.id.startsWith('tmp-')) return // the first save is still in flight
    if (existing) {
      setMine((s) => s.map((m) => (m.id === existing.id ? { ...m, enabled: next } : m)))
      await supabase.from('user_sources').update({ enabled: next }).eq('id', existing.id)
    } else {
      // Optimistic: move the switch right away, then swap the temporary row for the saved one (or drop it if the insert failed).
      const temp: UserSource = { id: `tmp-${d.id}`, default_source_id: d.id, name: null, url: null, enabled: next, sort_order: 0 }
      setMine((s) => [...s, temp])
      const { data } = await supabase.from('user_sources').insert({ user_id: userId, default_source_id: d.id, enabled: next }).select().single()
      setMine((s) => (data ? s.map((m) => (m.id === temp.id ? (data as UserSource) : m)) : s.filter((m) => m.id !== temp.id)))
    }
    invalidate()
  }

  async function addCustom(e: FormEvent) {
    e.preventDefault()
    const u = normalizeUrl(url)
    if (!u) { setErr(t('settings.invalidUrl')); return }
    setErr(''); setBusy(true)
    const { data, error } = await supabase.from('user_sources').insert({ user_id: userId, url: u, name: name.trim() || null, enabled: true }).select().single()
    setBusy(false)
    if (error) { setErr(/duplicate|unique/i.test(error.message) ? t('settings.sourceExists') : t('error.generic')); return }
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
        <div className="chips" role="group" aria-label={t('feed.sections')}>
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
        <span className="muted src-count">{activeCount === 1 ? t('settings.activeSourcesOne') : t(activeCount >= 20 ? 'settings.activeSourcesMany' : 'settings.activeSources', { n: activeCount })}</span>
      </div>

      {shown.length === 0 && !showCustom && <p className="muted" style={{ margin: 0 }}>{t('settings.noSources')}</p>}

      <div className="src-grid">
        {shown.map((d) => (
          <div className="src-card clickable" key={d.id} data-on={isOn(d)} onClick={() => toggleDefault(d)}>
            <img className="src-icon" src={faviconFor(d.site_url ?? d.url)} alt="" width={28} height={28} loading="lazy" />
            <div className="grow">
              <b>{d.name}</b>
              <small>{hostname(d.site_url ?? d.url)}</small>
            </div>
            <span className="lang-badge">{d.language.toUpperCase()}</span>
            <button type="button" role="switch" className="switch" aria-checked={isOn(d)} aria-label={d.name} onClick={(e) => { e.stopPropagation(); toggleDefault(d) }} />
          </div>
        ))}
        {showCustom && custom.map((m) => (
          <div className="src-card clickable" key={m.id} data-on={m.enabled} onClick={() => toggleCustom(m)}>
            <img className="src-icon" src={faviconFor(m.url!)} alt="" width={28} height={28} loading="lazy" />
            <div className="grow"><b>{m.name || hostname(m.url!)}</b><small title={m.url!}>{hostname(m.url!)}</small></div>
            <button type="button" className="icon-btn" aria-label={t('settings.remove')} title={t('settings.remove')} onClick={(e) => { e.stopPropagation(); remove(m) }}>✕</button>
            <button type="button" role="switch" className="switch" aria-checked={m.enabled} aria-label={m.name || m.url!} onClick={(e) => { e.stopPropagation(); toggleCustom(m) }} />
          </div>
        ))}
      </div>

      <form className="field add-source" onSubmit={addCustom}>
        <span>{t('settings.addSource')}</span>
        <div className="row">
          <input className="input" style={{ flex: '2 1 240px' }} type="text" inputMode="url" autoComplete="off" aria-label={t('settings.sourceUrl')} placeholder={t('settings.sourceUrl')} value={url} onChange={(e) => setUrl(e.target.value)} required />
          <input className="input" style={{ flex: '1 1 160px' }} autoComplete="off" aria-label={t('settings.sourceName')} placeholder={t('settings.sourceName')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy}>{t('settings.add')}</button>
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

  // Searches as the person types, like the team search: a short pause, and only the latest answer counts.
  useEffect(() => {
    const name = q.trim()
    if (name.length < 2) return
    const ctrl = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=${profile.language}&format=json`, { signal: ctrl.signal })
        const json = await res.json()
        setResults((json.results as Geo[]) ?? [])
      } catch { if (!ctrl.signal.aborted) setResults([]) }
    }, 350)
    return () => { window.clearTimeout(timer); ctrl.abort() }
  }, [q, profile.language])

  // Results show only while there is something to search for; picking a city clears the field.
  const shown = q.trim().length >= 2 ? results : null
  return (
    <div className="stack picker">
      {profile.weather_city ? (
        <div className="src-card">
          <WeatherIcon code={0} className="src-icon" />
          <div className="grow"><b>{profile.weather_city}</b></div>
          <button type="button" className="icon-btn" aria-label={t('settings.weatherClear')} title={t('settings.weatherClear')}
            onClick={() => update({ weather_city: null, weather_lat: null, weather_lon: null })}>✕</button>
        </div>
      ) : null}
      <input className="input" type="text" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label={t('settings.weatherCity')} placeholder={t('settings.weatherCity')}
        value={q} onChange={(e) => setQ(e.target.value)} />
      {shown && shown.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('settings.weatherNone')}</p>}
      {shown && shown.length > 0 && (
        <div className="results">
          {shown.map((r) => (
            <button key={r.id} type="button" onClick={() => { update({ weather_city: r.name, weather_lat: r.latitude, weather_lon: r.longitude }); setResults(null); setQ('') }}>
              {r.name}{r.admin1 ? `, ${r.admin1}` : ''}{r.country ? ` · ${r.country}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Diacritics-insensitive match for the team search ("Munchen" finds "München").
const foldText = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const TEAMS_CACHE = 'homepage.sport.teams'

function SportTeams({ t, teams, onChange }: { t: T; teams: Team[]; onChange: (teams: Team[]) => void }) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<SportTeamOption[] | null>(() => {
    try { const c = JSON.parse(sessionStorage.getItem(TEAMS_CACHE) ?? 'null'); return c && Date.now() - c.at < 86_400_000 ? c.teams : null } catch { return null }
  })
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  // The list (a few hundred teams) is fetched once, when the person starts searching, then filtered locally.
  async function ensureOptions() {
    if (options || state === 'loading') return
    setState('loading')
    const { data, error } = await supabase.functions.invoke<{ teams: SportTeamOption[]; complete: boolean }>('sport', { body: { action: 'teams' } })
    if (error || !data?.teams) { setState('error'); return }
    setOptions(data.teams); setState('idle')
    if (data.complete) sessionStorage.setItem(TEAMS_CACHE, JSON.stringify({ at: Date.now(), teams: data.teams }))
  }

  const query = foldText(q.trim())
  const results = query.length < 2 || !options ? [] : options
    .filter((o) => !teams.some((x) => x.id === o.id))
    .filter((o) => foldText(`${o.name} ${o.short_name ?? ''} ${o.tla ?? ''} ${o.area ?? ''}`).includes(query))
    .slice(0, 8)
  const full = teams.length >= MAX_TEAMS

  return (
    <div className="stack picker">
      {teams.map((team) => (
        <div key={team.id} className="src-card">
          {team.crest ? <img className="team-crest" src={team.crest} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} /> : <span className="team-crest" />}
          <div className="grow"><b>{team.name}</b></div>
          <button type="button" className="icon-btn" aria-label={t('settings.sportRemove')} title={t('settings.sportRemove')}
            onClick={() => onChange(teams.filter((x) => x.id !== team.id))}>✕</button>
        </div>
      ))}
      {full ? <p className="muted" style={{ margin: 0 }}>{t('settings.sportMax', { n: MAX_TEAMS })}</p> : (
        <input className="input" type="text" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label={t('settings.sportSearch')} placeholder={t('settings.sportSearch')}
          value={q} onFocus={ensureOptions} onChange={(e) => { setQ(e.target.value); void ensureOptions() }} />
      )}
      {state === 'loading' && query && <p className="muted" style={{ margin: 0 }}>{t('settings.sportLoading')}</p>}
      {state === 'error' && <p className="muted" style={{ margin: 0 }}>{t('settings.sportUnavailable')}</p>}
      {options && query.length >= 2 && results.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('settings.sportNone')}</p>}
      {results.length > 0 && (
        <div className="results">
          {results.map((o) => (
            <button key={o.id} type="button" onClick={() => { onChange([...teams, { id: o.id, name: o.name, tla: o.tla, crest: o.crest }]); setQ('') }}>
              {o.name}{o.area ? ` · ${o.area}` : ''}
            </button>
          ))}
        </div>
      )}
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
    if (error) { setMsg({ ok: false, text: /different/i.test(error.message) ? t('account.passwordSame') : t('error.generic') }); return }
    setMsg({ ok: true, text: t('account.passwordSaved') }); setCurrent(''); setPw(''); setPw2('')
    if (!hasPassword) onSet()
  }

  return (
    <form className="stack" onSubmit={submit}>
      {/* Lets password managers tie the new password to this account; not shown. */}
      <input className="visually-hidden" type="email" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
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
      <div><button className="btn primary" type="submit" disabled={busy}>{t('account.save')}</button></div>
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
      const known = r.error === 'invalid_email' ? t('invites.error.invalid_email') : /already|exists|registered/i.test(r.error) ? t('invites.error.exists') : t('error.generic')
      setMsg({ ok: false, text: known }); return
    }
    setMsg({ ok: true, text: t('invites.sent') }); setEmail(''); if (r.accounts) setAccounts(r.accounts)
  }

  async function remove(a: Account) {
    if (!window.confirm(t('invites.confirmRemove', { email: a.email }))) return
    const r = await call({ action: 'remove', user_id: a.id })
    if (r.error) { setMsg({ ok: false, text: t('error.generic') }); return }
    if (r.accounts) setAccounts(r.accounts)
  }

  return (
    <div className="two-col">
      <form className="stack" onSubmit={invite}>
        <Field label={t('invites.email')}>
          <div className="row">
            <input className="input" style={{ flex: 1 }} type="email" inputMode="email" autoComplete="off" required aria-label={t('invites.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn primary" type="submit" disabled={busy}>{t('invites.send')}</button>
          </div>
        </Field>
        {msg && <div className={`msg ${msg.ok ? '' : 'error'}`}>{msg.text}</div>}
      </form>
      <div className="stack">
        <Field label={t('invites.accounts')}>
          <div className="stack" style={{ gap: 10 }}>
            {accounts === null && <span className="muted">…</span>}
            {accounts?.map((a) => (
              <div className="src-card" key={a.id} data-on={a.status === 'active'}>
                <div className="grow">
                  <b>{a.display_name || a.email}</b>
                  {a.display_name && <small>{a.email}</small>}
                  {a.last_sign_in_at && <small>{t('invites.lastSeen', { time: timeAgo(a.last_sign_in_at, lang, t('time.now')) })}</small>}
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
