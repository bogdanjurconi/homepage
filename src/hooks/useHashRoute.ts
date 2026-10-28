import { useEffect, useState } from 'react'

export type Route = 'feed' | 'saved' | 'settings'

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h.startsWith('saved')) return 'saved'
  if (h.startsWith('settings')) return 'settings'
  return 'feed'
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const go = (r: Route) => { window.location.hash = r === 'feed' ? '/' : `/${r}` }
  return [route, go]
}
