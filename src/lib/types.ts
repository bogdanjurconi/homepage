export type Language = 'ro' | 'en'
export type Theme = 'light' | 'dark' | 'auto'
export type TextSize = 'small' | 'normal' | 'large'
export type Layout = 'list' | 'cards' | 'magazine'
export type Font = 'system' | 'serif' | 'rounded'
export type Background = 'flat' | 'tinted' | 'paper'
export type PresetAccent = 'blue' | 'teal' | 'green' | 'amber' | 'coral' | 'violet'
// A preset name, or a colour the person picked ("#rrggbb"), see lib/accent.ts
export type Accent = PresetAccent | `#${string}`
export type SearchEngine = 'google' | 'brave'

export const ACCENTS: PresetAccent[] = ['blue', 'teal', 'green', 'amber', 'coral', 'violet']
export const LAYOUTS: Layout[] = ['cards', 'magazine', 'list']

export const FONTS: Font[] = ['system', 'serif', 'rounded']
export const BACKGROUNDS: Background[] = ['flat', 'tinted', 'paper']
export const TEXT_SIZES: TextSize[] = ['small', 'normal', 'large']
export const SEARCH_ENGINES: SearchEngine[] = ['google', 'brave']

export interface Profile {
  id: string
  display_name: string | null
  language: Language
  theme: Theme
  accent: Accent
  // the last colour picked for the custom swatch, kept while a preset is in use
  accent_custom: string | null
  text_size: TextSize
  layout: Layout
  font: Font
  background: Background
  search_engine: SearchEngine
  show_rates: boolean
  show_calendar: boolean
  show_search: boolean
  open_in_reader: boolean
  is_admin: boolean
  has_password: boolean
  show_summary: boolean
  rate_currencies: string[]
  weather_city: string | null
  weather_lat: number | null
  weather_lon: number | null
  teams: Team[]
}

export const DEFAULT_PROFILE: Omit<Profile, 'id'> = {
  display_name: null,
  language: 'en',
  theme: 'auto',
  accent: 'blue',
  accent_custom: null,
  text_size: 'normal',
  layout: 'cards',
  font: 'system',
  background: 'flat',
  search_engine: 'google',
  show_rates: true,
  show_calendar: true,
  show_search: true,
  open_in_reader: false,
  is_admin: false,
  has_password: false,
  show_summary: true,
  rate_currencies: ['EUR', 'USD', 'GBP'],
  weather_city: null,
  weather_lat: null,
  weather_lon: null,
  teams: [],
}

export type Category = 'news' | 'tech' | 'sport' | 'other' | 'custom'
export const CATEGORY_ORDER: Category[] = ['news', 'tech', 'sport', 'other', 'custom']

export interface DefaultSource {
  id: string
  name: string
  url: string
  site_url: string | null
  category: Exclude<Category, 'custom'>
  language: string
  enabled_by_default: boolean
  sort_order: number
}

export interface UserSource {
  id: string
  default_source_id: string | null
  name: string | null
  url: string | null
  enabled: boolean
  sort_order: number
}

export interface FeedSource {
  name: string
  url: string
  category: Category
  sort_order: number
  is_custom: boolean
  title?: string | null
  last_fetched_at?: string | null
  last_error?: string | null
}

export interface FeedItem {
  id: string
  feed_url: string
  title: string
  link: string
  summary: string | null
  image_url: string | null
  published_at: string | null
}

export interface FeedsResponse {
  sources: FeedSource[]
  items: FeedItem[]
  refreshed: number
}

export interface QuickLink {
  id: string
  title: string
  url: string
  sort_order: number
}

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'HUF'] as const

export interface Rate {
  code: string
  value: number
  multiplier: number
  prev_value: number | null
  change: number | null
  change_pct: number | null
}

export interface Rates {
  date: string
  prev_date: string | null
  source: string
  rates: Rate[]
}

// Football (football-data.org ids). A followed team is stored on the profile with what the card needs to draw it.
export interface Team {
  id: number
  name: string
  tla: string | null
  crest: string | null
}
export const MAX_TEAMS = 5

export interface SportTeamOption extends Team {
  short_name: string | null
  area: string | null
  competitions: string[]
}

export interface SportSide { id: number; name: string; shortName: string | null; tla: string | null; crest: string | null }
export interface SportMatch {
  id: number
  utcDate: string
  status: string
  minute: number | null
  competition: { name: string; code: string; emblem: string | null }
  home: SportSide
  away: SportSide
  score: { home: number | null; away: number | null }
}
export interface SportTeamStatus { team: SportSide; live: SportMatch | null; next: SportMatch | null; last: SportMatch | null; error?: string }
export interface SportResponse { teams: SportTeamStatus[]; at: string }

export interface ReaderArticle {
  title: string
  byline: string | null
  site_name: string
  excerpt: string | null
  content: string
  length: number | null
  url: string
  image_url: string | null
}

export interface Account {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  created_at: string
  last_sign_in_at: string | null
  invited_at: string | null
  status: 'active' | 'invited' | 'inactive'
}
