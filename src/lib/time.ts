import type { Language } from './types'

export function timeAgo(iso: string | null, lang: Language, nowLabel: string): string {
  if (!iso) return ''
  const diff = (Date.parse(iso) - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return nowLabel
  // Minutes use the short form ('acum 21 min.') so the card footer keeps room for the source name;
  // hours and days are already short in the long form ('acum 2 ore', 'ieri').
  if (abs < 3600) return new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' }).format(Math.round(diff / 60), 'minute')
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(new Date(iso))
}

export function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
