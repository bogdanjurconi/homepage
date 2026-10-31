import type { Key, T } from '../lib/i18n'
import type { Language } from '../lib/types'
import WeatherIcon from './WeatherIcon'
import { useForecast } from '../hooks/useForecast'

type Props = { lat: number; lon: number; city: string | null; lang: Language; t: T }

export default function WeatherCard({ lat, lon, city, lang, t }: Props) {
  const { data, error } = useForecast(lat, lon)

  if (error) return <section className="card weather weather-empty muted">{t('weather.error')}</section>
  if (!data) return <section className="card weather weather-empty muted" aria-busy="true">…</section>

  const { current: c, daily } = data
  const isDay = c.is_day === 1
  const dayName = (iso: string, i: number) => {
    if (i === 0) return t('weather.today')
    if (i === 1) return t('weather.tomorrow')
    const s = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(iso))
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  return (
    <section className="card weather" aria-label={t('settings.weather')}>
      <div className="w-now">
        <WeatherIcon code={c.weather_code} isDay={isDay} className="w-icon" />
        <div className="w-temp">{Math.round(c.temperature_2m)}<span>°</span></div>
        <div className="w-text">
          <div className="w-cond">{t(`wmo.${c.weather_code}` as Key)}</div>
          <div className="w-sub">{city}{city ? ' · ' : ''}{t('weather.feels', { t: ` ${Math.round(c.apparent_temperature)}°` })}</div>
          <div className="w-chips">
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
