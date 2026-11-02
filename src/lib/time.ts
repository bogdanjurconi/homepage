import type { Language } from './types'

// Intl formatters are costly to build; one of each per language, shared by every card.
const cache = new Map<string, Intl.RelativeTimeFormat | Intl.DateTimeFormat>()
const relative = (lang: Language, style: 'short' | 'long') => {
  const k = `r:${lang}:${style}`
  let f = cache.get(k) as Intl.RelativeTimeFormat | undefined
  if (!f) { f = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style }); cache.set(k, f) }
  return f
}
const dayMonth = (lang: Language) => {
  const k = `d:${lang}`
  let f = cache.get(k) as Intl.DateTimeFormat | undefined
  if (!f) { f = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }); cache.set(k, f) }
  return f
}

export function timeAgo(iso: string | null, lang: Language, nowLabel: string): string {
  if (!iso) return ''
  const diff = (Date.parse(iso) - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return nowLabel
  // Minutes use the short form ('acum 21 min.') so the card footer keeps room for the source name;
  // hours and days are already short in the long form ('acum 2 ore', 'ieri').
  if (abs < 3600) return relative(lang, 'short').format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return relative(lang, 'long').format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return relative(lang, 'long').format(Math.round(diff / 86400), 'day')
  return dayMonth(lang).format(new Date(iso))
}

export function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
