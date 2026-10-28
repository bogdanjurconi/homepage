// Romanian public holidays and the main Orthodox feast days used as name days.
import type { Language } from './types'

export type CalEvent = { date: Date; name: string; holiday: boolean; names?: string }

// Orthodox Easter (Meeus Julian algorithm), returned as a Gregorian date. Valid 1900–2099.
export function orthodoxEaster(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  const julian = new Date(Date.UTC(year, month - 1, day))
  julian.setUTCDate(julian.getUTCDate() + 13)
  return new Date(julian.getUTCFullYear(), julian.getUTCMonth(), julian.getUTCDate())
}

const FIXED: [number, number, string, boolean, string?][] = [
  // month, day, name, public holiday, name-day hint
  [1, 1, 'Anul Nou · Sf. Vasile cel Mare', true, 'Vasile, Vasilica'],
  [1, 2, 'A doua zi de Anul Nou', true],
  [1, 6, 'Boboteaza', true],
  [1, 7, 'Sf. Ioan Botezătorul', true, 'Ion, Ioana, Ionuț, Ionel, Nelu, Oana'],
  [1, 17, 'Sf. Antonie cel Mare', false, 'Anton, Antonia'],
  [1, 24, 'Unirea Principatelor Române', true],
  [1, 25, 'Sf. Grigorie Teologul', false, 'Grigore'],
  [1, 30, 'Sfinții Trei Ierarhi', false, 'Vasile, Grigore, Ioan'],
  [2, 10, 'Sf. Haralambie', false, 'Haralambie'],
  [3, 9, 'Sfinții 40 de Mucenici', false],
  [3, 25, 'Buna Vestire', false],
  [4, 23, 'Sf. Gheorghe', false, 'Gheorghe, George, Georgiana, Geta'],
  [5, 1, 'Ziua Muncii', true],
  [5, 21, 'Sf. Constantin și Elena', false, 'Constantin, Costel, Elena, Ileana, Lena'],
  [6, 1, 'Ziua Copilului', true],
  [6, 24, 'Nașterea Sf. Ioan Botezătorul · Sânziene', false, 'Ion, Ioana, Sânziana'],
  [6, 29, 'Sf. Petru și Pavel', false, 'Petre, Petru, Petra, Pavel, Paul, Paula'],
  [7, 20, 'Sf. Ilie', false, 'Ilie, Ilinca'],
  [7, 27, 'Sf. Pantelimon', false, 'Pantelimon'],
  [8, 6, 'Schimbarea la Față', false],
  [8, 15, 'Adormirea Maicii Domnului', true, 'Maria, Marian, Mariana, Marius'],
  [8, 29, 'Tăierea capului Sf. Ioan Botezătorul', false, 'Ion, Ioana'],
  [9, 8, 'Nașterea Maicii Domnului (Sf. Maria Mică)', false, 'Maria, Mariana, Marian'],
  [9, 14, 'Înălțarea Sfintei Cruci', false, 'Cristian, Cristina'],
  [10, 14, 'Sf. Parascheva', false, 'Paraschiva'],
  [10, 26, 'Sf. Dumitru', false, 'Dumitru, Mitică, Dumitra'],
  [10, 27, 'Sf. Dimitrie cel Nou', false, 'Dimitrie, Dimitri'],
  [11, 8, 'Sf. Mihail și Gavriil', false, 'Mihai, Mihaela, Gabriel, Gabriela'],
  [11, 21, 'Intrarea în Biserică a Maicii Domnului', false],
  [11, 25, 'Sf. Ecaterina', false, 'Ecaterina, Cătălin, Cătălina'],
  [11, 30, 'Sf. Andrei', true, 'Andrei, Andreea'],
  [12, 1, 'Ziua Națională a României', true],
  [12, 6, 'Sf. Nicolae', false, 'Nicolae, Nicoleta, Nicu, Nicușor'],
  [12, 25, 'Crăciunul', true],
  [12, 26, 'A doua zi de Crăciun', true],
  [12, 27, 'Sf. Ștefan', false, 'Ștefan, Ștefania'],
]

export function eventsForYear(year: number): CalEvent[] {
  const list: CalEvent[] = FIXED.map(([m, d, name, holiday, names]) => ({ date: new Date(year, m - 1, d), name, holiday, names }))
  const easter = orthodoxEaster(year)
  const shift = (days: number) => { const x = new Date(easter); x.setDate(x.getDate() + days); return x }
  list.push(
    { date: shift(-7), name: 'Floriile', holiday: false, names: 'Florin, Florina, Florentina, Viorel, Viorica, Camelia, Narcisa' },
    { date: shift(-2), name: 'Vinerea Mare', holiday: true },
    { date: shift(0), name: 'Paștele', holiday: true },
    { date: shift(1), name: 'A doua zi de Paște', holiday: true },
    { date: shift(49), name: 'Rusaliile', holiday: true },
    { date: shift(50), name: 'A doua zi de Rusalii', holiday: true },
  )
  return list.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function todayAndUpcoming(now = new Date(), horizonDays = 14): { today: CalEvent[]; upcoming: (CalEvent & { inDays: number })[] } {
  const t0 = startOfDay(now).getTime()
  const all = [...eventsForYear(now.getFullYear()), ...eventsForYear(now.getFullYear() + 1)]
  const today = all.filter((e) => startOfDay(e.date).getTime() === t0)
  const upcoming = all
    .map((e) => ({ ...e, inDays: Math.round((startOfDay(e.date).getTime() - t0) / 86_400_000) }))
    .filter((e) => e.inDays > 0 && e.inDays <= horizonDays)
    .slice(0, 3)
  return { today, upcoming }
}

export function formatDay(d: Date, lang: Language): string {
  return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}
