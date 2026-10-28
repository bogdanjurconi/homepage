import { useEffect, useState } from 'react'
import type { Key, T } from '../lib/i18n'
import type { Language } from '../lib/types'
import WeatherIcon, { themeFor } from './WeatherIcon'

type Props = { lat: number; lon: number; city: string | null; lang: Language; t: T }

type Forecast = {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; is_day: number }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] }
}

const CACHE_KEY = 'homepage.weather.v3'

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

  if (error) return <section className="weather weather-empty muted">{t('weather.error')}</section>
  if (!data) return <section className="weather weather-empty" data-theme-w="cloudy" aria-busy="true" />

  const { current: c, daily } = data
  const isDay = c.is_day === 1
  const dayName = (iso: string, i: number) =>
    i === 0 ? t('weather.today') : i === 1 ? t('weather.tomorrow') : new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(iso))
  const hi = Math.round(daily.temperature_2m_max[0]), lo = Math.round(daily.temperature_2m_min[0])

  return (
    <section className="weather" data-theme-w={themeFor(c.weather_code, isDay)} aria-label={t('settings.weather')}>
      <div className="w-now">
        <WeatherIcon code={c.weather_code} isDay={isDay} className="w-icon" />
        <div className="w-temp">{Math.round(c.temperature_2m)}<span>°</span></div>
        <div className="w-text">
          <div className="w-cond">{t(`wmo.${c.weather_code}` as Key)}</div>
          <div className="w-sub">{city}{city ? ' · ' : ''}{t('weather.feels', { t: ` ${Math.round(c.apparent_temperature)}°` })}</div>
          <div className="w-chips">
            <span>↑ {hi}°  ↓ {lo}°</span>
            <span>{t('weather.wind')} {Math.round(c.wind_speed_10m)} km/h</span>
            <span>{t('weather.humidity')} {c.relative_humidity_2m}%</span>
          </div>
        </div>
      </div>
      <ol className="w-days">
        {daily.time.map((d, i) => {
          const rain = daily.precipitation_probability_max[i]
          return (
            <li key={d}>
              <small>{dayName(d, i)}</small>
              <WeatherIcon code={daily.weather_code[i]} className="w-day-icon" />
              <b>{Math.round(daily.temperature_2m_max[i])}°</b>
              <small>{Math.round(daily.temperature_2m_min[i])}°</small>
              <small className="w-rain">{rain != null && rain >= 20 ? `${rain}%` : ' '}</small>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
