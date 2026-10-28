import { useState } from 'react'
import type { QuickLink } from '../lib/types'
import { hostname } from '../lib/time'

export function faviconFor(url: string): string {
  return `https://icons.duckduckgo.com/ip3/${hostname(url)}.ico`
}

function Tile({ link }: { link: QuickLink }) {
  const [ok, setOk] = useState(true)
  return (
    <a className="tile" href={link.url} rel="noopener">
      <span className="tile-icon" aria-hidden="true">
        {ok ? <img src={faviconFor(link.url)} alt="" width={32} height={32} loading="lazy" onError={() => setOk(false)} /> : link.title.slice(0, 1).toUpperCase()}
      </span>
      <span className="tile-label">{link.title}</span>
    </a>
  )
}

export default function QuickLinks({ links, label }: { links: QuickLink[]; label: string }) {
  if (links.length === 0) return null
  return (
    <nav className="tiles" aria-label={label}>
      {links.map((l) => <Tile key={l.id} link={l} />)}
    </nav>
  )
}
