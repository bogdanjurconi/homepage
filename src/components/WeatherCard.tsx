import { useEffect, useState } from 'react'
import type { Key, T } from '../lib/i18n'
import type { Language } from '../lib/types'

type Props = { lat: number; lon: number; city: string | null; lang: Language; t: T }

type Forecast = {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; is_day: number }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] }
}

const ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️', 71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '🌨️', 95: '⛈️', 96: '⛈️', 99: '⛈️',
}
const NIGHT: Record<number, string> = { 0: '🌙', 1: '🌙', 2: '☁️' }

const CACHE_KEY = 'homepage.weather'

export default function WeatherCard({ lat, lon, city, lang, t }: Props) {
  const [data, setData] = useState<Forecast | null>(() => {
    try { const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null'); return c && c.key === `${lat},${lon}` && Date.now() - c.at < 20 * 60_000 ? c.data : null } catch { return null }
  })
  const [error, setError] = useState(false)

  useEffect(() => {
    if (data) return
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`
    fetch(url).then((r) => r.json()).then((d: Forecast) => {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ key: `${lat},${lon}`, at: Date.now(), data: d }))
      setData(d)
    }).catch(() => setError(true))
  }, [lat, lon, data])

  if (error) return <section className="card weather weather-empty muted">{t('weather.error')}</section>
  if (!data) return <section className="card weather weather-empty muted">…</section>

  const code = data.current.weather_code
  const icon = (data.current.is_day === 0 && NIGHT[code]) || ICONS[code] || '🌡️'
  const dayName = (iso: string, i: number) =>
    i === 0 ? t('weather.today') : i === 1 ? t('weather.tomorrow') : new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(iso))

  return (
    <section className="card weather" aria-label={t('settings.weather')}>
      <div className="weather-now">
        <div className="weather-icon" aria-hidden="true">{icon}</div>
        <div className="weather-main">
          <div className="weather-temp">{Math.round(data.current.temperature_2m)}°</div>
          <div className="weather-cond">{t(`wmo.${code}` as Key)}{city ? <span className="muted"> · {city}</span> : null}</div>
        </div>
        <dl className="weather-stats">
          <div><dt>{t('weather.feels', { t: '' }).trim()}</dt><dd>{Math.round(data.current.apparent_temperature)}°</dd></div>
          <div><dt>{t('weather.wind')}</dt><dd>{Math.round(data.current.wind_speed_10m)} km/h</dd></div>
          <div><dt>{t('weather.humidity')}</dt><dd>{data.current.relative_humidity_2m}%</dd></div>
        </dl>
      </div>
      <div className="weather-days">
        {data.daily.time.map((d, i) => {
          const rain = data.daily.precipitation_probability_max[i]
          return (
            <div className="weather-day" key={d}>
              <small>{dayName(d, i)}</small>
              <span className="weather-day-icon" aria-hidden="true">{ICONS[data.daily.weather_code[i]] ?? '🌡️'}</span>
              <b>{Math.round(data.daily.temperature_2m_max[i])}°</b>
              <small>{Math.round(data.daily.temperature_2m_min[i])}°</small>
              {rain != null && rain >= 20 && <small className="weather-rain" title={t('weather.rain')}>💧 {rain}%</small>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
