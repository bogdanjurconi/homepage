export type Language = 'ro' | 'en'
export type Theme = 'light' | 'dark' | 'auto'
export type TextSize = 'small' | 'normal' | 'large' | 'xlarge'
export type Layout = 'list' | 'cards' | 'magazine'
export type Font = 'system' | 'serif' | 'rounded'
export type Background = 'flat' | 'tinted' | 'paper'
export type Accent = 'blue' | 'indigo' | 'purple' | 'pink' | 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'slate'

export const ACCENTS: Accent[] = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'amber', 'green', 'teal', 'slate']
export const LAYOUTS: Layout[] = ['cards', 'magazine', 'list']
export const FONTS: Font[] = ['system', 'serif', 'rounded']
export const BACKGROUNDS: Background[] = ['flat', 'tinted', 'paper']
export const TEXT_SIZES: TextSize[] = ['small', 'normal', 'large', 'xlarge']

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
  weather_city: string | null
  weather_lat: number | null
  weather_lon: number | null
}

export const DEFAULT_PROFILE: Omit<Profile, 'id'> = {
  display_name: null,
  language: 'ro',
  theme: 'auto',
  accent: 'blue',
  text_size: 'normal',
  layout: 'cards',
  font: 'system',
  background: 'flat',
  weather_city: null,
  weather_lat: null,
  weather_lon: null,
}

export interface DefaultSource {
  id: string
  name: string
  url: string
  site_url: string | null
  category: 'news' | 'tech' | 'sport' | 'other'
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
  category: string
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
