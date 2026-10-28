// Simple line icons for WMO weather codes. Consistent on every device, unlike emoji.
type Kind = 'sun' | 'moon' | 'partly' | 'partly-night' | 'cloud' | 'fog' | 'rain' | 'drizzle' | 'snow' | 'thunder'

export function kindFor(code: number, isDay = true): Kind {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon'
  if (code === 2) return isDay ? 'partly' : 'partly-night'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'thunder'
  return 'cloud'
}

const Sun = () => <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></>
const Moon = () => <path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.1A7 7 0 0 1 15.5 3.5z" />
const Cloud = ({ y = 0 }: { y?: number }) => <path transform={`translate(0 ${y})`} d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 11.5a3.5 3.5 0 0 0 0 7z" />

export default function WeatherIcon({ code, isDay = true, className }: { code: number; isDay?: boolean; className?: string }) {
  const kind = kindFor(code, isDay)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'sun' && <Sun />}
      {kind === 'moon' && <Moon />}
      {kind === 'partly' && <><g transform="translate(5 -1) scale(.7)"><Sun /></g><Cloud y={1} /></>}
      {kind === 'partly-night' && <><g transform="translate(7 -2) scale(.6)"><Moon /></g><Cloud y={1} /></>}
      {kind === 'cloud' && <Cloud />}
      {kind === 'fog' && <><Cloud y={-3} /><path d="M6 19h12M8 22h8" /></>}
      {kind === 'drizzle' && <><Cloud y={-3} /><path d="M9 19v1.5M12 19v1.5M15 19v1.5" /></>}
      {kind === 'rain' && <><Cloud y={-3} /><path d="M9 18.5l-1 3M12.5 18.5l-1 3M16 18.5l-1 3" /></>}
      {kind === 'snow' && <><Cloud y={-3} /><path d="M9 19.5h.01M12 21h.01M15 19.5h.01" strokeWidth="2.4" /></>}
      {kind === 'thunder' && <><Cloud y={-3} /><path d="M12.5 17l-2 3.5h3l-2 3.5" /></>}
    </svg>
  )
}

export function themeFor(code: number, isDay: boolean): string {
  const kind = kindFor(code, isDay)
  if (!isDay) return 'night'
  if (kind === 'sun') return 'clear'
  if (kind === 'partly') return 'partly'
  if (kind === 'rain' || kind === 'drizzle' || kind === 'thunder') return 'rain'
  if (kind === 'snow') return 'snow'
  return 'cloudy'
}
