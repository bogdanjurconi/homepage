import type { FeedsResponse } from './types'

// The last feeds response, kept per account in localStorage: a new tab or a cold start shows the news at once
// and refreshes them in the background. The Saved page reads the source names from it.
const key = (userId: string) => `homepage.feed.${userId}`
export type CachedFeed = FeedsResponse & { at: string }

export function readFeedCache(userId: string): CachedFeed | null {
  try { const raw = localStorage.getItem(key(userId)); return raw ? (JSON.parse(raw) as CachedFeed) : null } catch { return null }
}
export function writeFeedCache(userId: string, cached: CachedFeed) {
  try { localStorage.setItem(key(userId), JSON.stringify(cached)) } catch { /* storage full or private mode: the page still works */ }
}
