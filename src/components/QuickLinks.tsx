import type { QuickLink } from '../lib/types'
import SiteIcon from './SiteIcon'

export default function QuickLinks({ links, label }: { links: QuickLink[]; label: string }) {
  if (links.length === 0) return null
  return (
    <nav className="tiles" aria-label={label}>
      {links.map((l) => (
        <a key={l.id} className="tile" href={l.url} rel="noopener">
          <SiteIcon url={l.url} name={l.title} className="tile-icon" />
          <span className="tile-label">{l.title}</span>
        </a>
      ))}
    </nav>
  )
}
