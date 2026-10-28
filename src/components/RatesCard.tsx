import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { Language, Rates } from '../lib/types'

const CACHE_KEY = 'homepage.rates.v2'
const FLAGS: Record<string, string> = {
  EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', CHF: '🇨🇭', HUF: '🇭🇺', PLN: '🇵🇱', CZK: '🇨🇿', SEK: '🇸🇪', NOK: '🇳🇴',
  DKK: '🇩🇰', CAD: '🇨🇦', AUD: '🇦🇺', JPY: '🇯🇵', TRY: '🇹🇷', BGN: '🇧🇬',
}

export default function RatesCard({ lang, t, codes }: { lang: Language; t: T; codes: string[] }) {
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
  const fmtChange = new Intl.NumberFormat(lang, { minimumFractionDigits: 3, maximumFractionDigits: 3, signDisplay: 'always' })
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(new Date(data.date))
  const shown = codes.map((c) => data.rates.find((r) => r.code === c)).filter((r): r is NonNullable<typeof r> => !!r)

  return (
    <section className="card rates" aria-label={t('rates.title')} title={t('rates.source')}>
      <div className="rates-head">
        <b>{t('rates.title')}</b>
        <small className="muted">{date} · {t('rates.vs7d')}</small>
      </div>
      <ul className="rates-list">
        {shown.map((r) => (
          <li key={r.code}>
            <span className="rates-code"><span aria-hidden="true">{FLAGS[r.code] ?? ''}</span> {r.multiplier > 1 ? `${r.multiplier} ` : ''}{r.code}</span>
            <span className="rates-val">
              <b>{fmt.format(r.value)}</b>
              {r.change != null && (
                <small className={`rates-chg ${r.change > 0 ? 'up' : r.change < 0 ? 'down' : ''}`}>
                  {r.change > 0 ? '▲' : r.change < 0 ? '▼' : '='} {fmtChange.format(r.change)}
                </small>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
