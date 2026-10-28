import type { T } from '../lib/i18n'
import type { Language } from '../lib/types'
import { formatDay, todayAndUpcoming } from '../lib/calendar'

export default function CalendarCard({ lang, t }: { lang: Language; t: T }) {
  const { today, upcoming } = todayAndUpcoming()
  if (today.length === 0 && upcoming.length === 0) return null
  return (
    <section className="card calendar" aria-label={t('calendar.title')}>
      {today.length > 0 && (
        <div className="cal-today">
          <small className="muted">{t('calendar.today')}</small>
          {today.map((e) => (
            <div key={e.name}>
              <b>{e.name}</b>{e.holiday && <span className="badge">{t('calendar.holiday')}</span>}
              {e.names && <div className="muted cal-names">{e.names}</div>}
            </div>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="cal-upcoming">
          <small className="muted">{t('calendar.upcoming')}</small>
          <ul>
            {upcoming.map((e) => (
              <li key={e.name + e.inDays}>
                <span className="muted">{formatDay(e.date, lang)}</span> {e.name}
                {e.holiday && <span className="badge">{t('calendar.holiday')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
