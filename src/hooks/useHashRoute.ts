import { useEffect, useState } from 'react'

export type RouteName = 'feed' | 'saved' | 'settings' | 'read'
export type Route = { name: RouteName; param?: string }

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h.startsWith('saved')) return { name: 'saved' }
  const settings = h.match(/^settings(?:\/([a-z]+))?/)
  if (settings) return { name: 'settings', param: settings[1] }
  const read = h.match(/^read\/([^/?#]+)/)
  if (read) return { name: 'read', param: decodeURIComponent(read[1]) }
  return { name: 'feed' }
}

export function hrefFor(name: RouteName, param?: string): string {
  if (name === 'feed') return '#/'
  return param ? `#/${name}/${encodeURIComponent(param)}` : `#/${name}`
}

export function useHashRoute(): [Route, (name: RouteName, param?: string) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => { setRoute(parse(window.location.hash)); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const go = (name: RouteName, param?: string) => { window.location.hash = hrefFor(name, param) }
  return [route, go]
}
