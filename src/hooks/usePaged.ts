import { useEffect, useRef, useState } from 'react'

/**
 * Reveals a long list one page at a time. The next page is added when the sentinel element
 * comes within `margin` of the viewport (or on demand through `more`), and the count goes back
 * to one page whenever `resetKey` changes (another section, new filter text).
 */
export function usePaged<T>(items: T[], resetKey: string, pageSize = 24, margin = '600px') {
  const [state, setState] = useState({ key: resetKey, limit: pageSize })
  // A new key means a new list: store the reset so an old key does not bring its old depth back.
  if (state.key !== resetKey) setState({ key: resetKey, limit: pageSize })
  const limit = state.key === resetKey ? state.limit : pageSize
  const hasMore = limit < items.length
  const sentinel = useRef<HTMLDivElement>(null)
  const more = () => setState((s) => ({ key: resetKey, limit: (s.key === resetKey ? s.limit : pageSize) + pageSize }))

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) more()
    }, { rootMargin: `${margin} 0px` })
    io.observe(el)
    return () => io.disconnect()
    // `limit` re-arms the observer after each page, so a sentinel still in view keeps loading.
  }, [hasMore, limit, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { shown: items.slice(0, limit), hasMore, more, sentinel }
}
