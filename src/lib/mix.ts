import type { FeedItem } from './types'

// Stories in a row one source may have while another source has something to show.
const MAX_RUN = 3
// A story may move ahead of newer ones by at most this much, so yesterday's news does not sit beside today's.
const MAX_PULL_MS = 24 * 3_600_000
const DAY_MS = 24 * 3_600_000
// Magazine rhythm: one large story, then a row of three small ones, then the next large one.
export const MAGAZINE_BLOCK = 4

const timeOf = (x: FeedItem) => Date.parse(x.published_at ?? '') || 0

/**
 * Fair share between sources (weighted fair queueing). Each source gets room on the page in proportion
 * to the square root of how much it posts: a site with 16 times more stories a day gets 4 times more
 * cards, not 16. Each source's own stories stay newest first; no source shows more than MAX_RUN in a
 * row while another one has a story waiting; and nothing jumps ahead by more than MAX_PULL_MS.
 */
export function mixSources(items: FeedItem[]): FeedItem[] {
  const queues = new Map<string, FeedItem[]>()
  for (const it of items) {
    const q = queues.get(it.feed_url) ?? []
    q.push(it); queues.set(it.feed_url, q)
  }
  if (queues.size < 2) return items
  for (const q of queues.values()) q.sort((a, b) => timeOf(b) - timeOf(a))
  const now = Date.now()
  const weight = new Map<string, number>()
  for (const [url, q] of queues) weight.set(url, Math.sqrt(Math.max(1, q.filter((x) => now - timeOf(x) <= DAY_MS).length)))
  const used = new Map<string, number>()
  const out: FeedItem[] = []
  let runSource = '', run = 0
  while (out.length < items.length) {
    const heads = [...queues.entries()].filter(([, q]) => q.length > 0).map(([url, q]) => ({ url, head: q[0] }))
    if (!heads.length) break
    const newest = Math.max(...heads.map((h) => timeOf(h.head)))
    const inTime = heads.filter((h) => newest - timeOf(h.head) <= MAX_PULL_MS)
    const varied = inTime.filter((h) => !(h.url === runSource && run >= MAX_RUN))
    const pool = varied.length ? varied : inTime
    // The source furthest behind its fair share goes next; on a tie, the newer story.
    const turn = (url: string) => ((used.get(url) ?? 0) + 1) / weight.get(url)!
    pool.sort((a, b) => turn(a.url) - turn(b.url) || timeOf(b.head) - timeOf(a.head))
    const { url } = pool[0]
    out.push(queues.get(url)!.shift()!)
    used.set(url, (used.get(url) ?? 0) + 1)
    if (url === runSource) run++
    else { runSource = url; run = 1 }
  }
  return out
}

/**
 * Magazine: in each block of MAGAZINE_BLOCK stories the lead is the first one with a picture,
 * preferring a source other than the previous lead's, and it moves to the front of its block.
 */
export function pickLeads(items: FeedItem[]): { items: FeedItem[]; leads: Set<string> } {
  const out: FeedItem[] = []
  const leads = new Set<string>()
  let lastLead: string | null = null
  for (let start = 0; start < items.length; start += MAGAZINE_BLOCK) {
    const block = items.slice(start, start + MAGAZINE_BLOCK)
    const idx = (() => {
      const other = block.findIndex((x) => x.image_url && x.feed_url !== lastLead)
      return other >= 0 ? other : block.findIndex((x) => x.image_url)
    })()
    if (idx > 0) block.unshift(...block.splice(idx, 1))
    if (idx >= 0) { leads.add(block[0].id); lastLead = block[0].feed_url }
    out.push(...block)
  }
  return { items: out, leads }
}
