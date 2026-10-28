import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { Language, Rates } from '../lib/types'

const CACHE_KEY = 'homepage.rates'
const FLAGS: Record<string, string> = { EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭', HUF: '🇭🇺' }

export default function RatesCard({ lang, t }: { lang: Language; t: T }) {
  const [data, setData] = useState<Rates | null>(() => {
    try { const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null'); return c && Date.now() - c.at < 3_600_000 ? c.data : null } catch { return null }
  })
  const [error, setError] = useState(false)

  useEffect(() => {
    if (data) return
    supabase.functions.invoke<Rates>('rates').then(({ data: d, error: e }) => {
      if (e || !d) { setError(true); return }
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: d }))
      setData(d)
    })
  }, [data])

  if (error) return <section className="card rates muted">{t('rates.error')}</section>
  if (!data) return <section className="card rates muted">…</section>
  const fmt = new Intl.NumberFormat(lang, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(new Date(data.date))
  return (
    <section className="card rates" aria-label={t('rates.title')}>
      <div className="rates-head"><b>{t('rates.title')}</b><small className="muted">{t('rates.source', { date })}</small></div>
      <ul className="rates-list">
        {data.rates.map((r) => (
          <li key={r.code}>
            <span><span aria-hidden="true">{FLAGS[r.code] ?? ''}</span> {r.multiplier > 1 ? `${r.multiplier} ` : ''}{r.code}</span>
            <b>{fmt.format(r.value)} <small>lei</small></b>
          </li>
        ))}
      </ul>
    </section>
  )
}
