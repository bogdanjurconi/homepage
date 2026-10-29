import type { FeedsResponse } from './types'

// Session cache of the last feeds response, shared by the Feed page (which fills it)
// and the Saved page (which reads the friendly source names from it).
export const FEED_CACHE_KEY = 'homepage.feed'
export type CachedFeed = FeedsResponse & { at: string }

export function readFeedCache(): CachedFeed | null {
  try { const raw = sessionStorage.getItem(FEED_CACHE_KEY); return raw ? (JSON.parse(raw) as CachedFeed) : null } catch { return null }
}
