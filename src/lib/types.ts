export type Language = 'ro' | 'en'
export type Theme = 'light' | 'dark' | 'auto'
export type TextSize = 'small' | 'normal' | 'large'
export type Layout = 'list' | 'cards' | 'magazine'
export type Font = 'system' | 'serif' | 'rounded'
export type Background = 'flat' | 'tinted' | 'paper'
export type Accent = 'blue' | 'teal' | 'green' | 'amber' | 'coral' | 'violet'
export type SearchEngine = 'google' | 'brave'

export const ACCENTS: Accent[] = ['blue', 'teal', 'green', 'amber', 'coral', 'violet']
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
  text_size: TextSize
  layout: Layout
  font: Font
  background: Background
  search_engine: SearchEngine
  show_rates: boolean
  show_calendar: boolean
  open_in_reader: boolean
  is_admin: boolean
  has_password: boolean
  rate_currencies: string[]
  weather_city: string | null
  weather_lat: number | null
  weather_lon: number | null
}

export const DEFAULT_PROFILE: Omit<Profile, 'id'> = {
  display_name: null,
  language: 'en',
  theme: 'auto',
  accent: 'blue',
  text_size: 'normal',
  layout: 'cards',
  font: 'system',
  background: 'flat',
  search_engine: 'google',
  show_rates: true,
  show_calendar: true,
  open_in_reader: false,
  is_admin: false,
  has_password: false,
  rate_currencies: ['EUR', 'USD', 'GBP'],
  weather_city: null,
  weather_lat: null,
  weather_lon: null,
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
