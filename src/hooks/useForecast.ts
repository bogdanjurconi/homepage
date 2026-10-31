import { useEffect, useState } from 'react'

export type Forecast = {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; is_day: number }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] }
}

const CACHE_KEY = 'homepage.weather.v3'
const FRESH_MS = 20 * 60_000

/** The Open-Meteo forecast for a place, kept for 20 minutes per tab so the card and Settings share one request. */
export function useForecast(lat: number | null, lon: number | null) {
  const key = lat != null && lon != null ? `${lat},${lon}` : null
  // Keyed by place: a new place reads the cache during render instead of waiting for an effect.
  const [state, setState] = useState<{ key: string | null; data: Forecast | null }>(() => ({ key, data: readCache(key) }))
  const data = state.key === key ? state.data : readCache(key)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!key || readCache(key)) return
    let cancelled = false
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`
    fetch(url).then((r) => r.json()).then((d: Forecast) => {
      if (!d?.current || !d?.daily?.time) throw new Error('bad forecast')
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), data: d }))
      if (!cancelled) { setState({ key, data: d }); setError(false) }
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [key, lat, lon])

  return { data: key ? data : null, error }
}

function readCache(key: string | null): Forecast | null {
  if (!key) return null
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null')
    return c && c.key === key && Date.now() - c.at < FRESH_MS && c.data?.current ? c.data : null
  } catch { return null }
}
