import { useEffect, useState } from 'react'
import type { T } from '../lib/i18n'
import type { Key } from '../lib/i18n'
import type { Language } from '../lib/types'

type Props = { lat: number; lon: number; city: string | null; lang: Language; t: T }

type Forecast = {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
}

const ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️', 71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '🌨️', 95: '⛈️', 96: '⛈️', 99: '⛈️',
}

export default function WeatherCard({ lat, lon, city, lang, t }: Props) {
  const [data, setData] = useState<Forecast | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`
    fetch(url).then((r) => r.json()).then(setData).catch(() => setError(true))
  }, [lat, lon])

  if (error) return <div className="card weather muted">{t('weather.error')}</div>
  if (!data) return <div className="card weather muted">…</div>

  const code = data.current.weather_code
  const label = t(`wmo.${code}` as Key)
  const dayName = (iso: string, i: number) =>
    i === 0 ? t('weather.today') : i === 1 ? t('weather.tomorrow') : new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(iso))

  return (
    <section className="card weather" aria-label={t('settings.weather')}>
      <div className="weather-icon" aria-hidden="true">{ICONS[code] ?? '🌡️'}</div>
      <div>
        <div className="weather-temp">{Math.round(data.current.temperature_2m)}°</div>
        <div className="weather-meta">{label}{city ? ` · ${city}` : ''}</div>
        <div className="weather-meta">{t('weather.feels', { t: Math.round(data.current.apparent_temperature) })}</div>
      </div>
      <div className="weather-days">
        {data.daily.time.map((d, i) => (
          <div className="weather-day" key={d}>
            <small>{dayName(d, i)}</small>
            <span aria-hidden="true">{ICONS[data.daily.weather_code[i]] ?? '🌡️'}</span>
            <small>{Math.round(data.daily.temperature_2m_max[i])}° / {Math.round(data.daily.temperature_2m_min[i])}°</small>
          </div>
        ))}
      </div>
    </section>
  )
}
