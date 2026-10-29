import type { T } from '../lib/i18n'
import type { Route, RouteName } from '../hooks/useHashRoute'
import { BrandIcon, GearIcon, HomeIcon, StarIcon } from './Icons'

type Props = { t: T; route: Route; go: (r: RouteName) => void; name?: string | null }

function Nav({ t, route, go, className }: Props & { className?: string }) {
  const items: { r: RouteName; label: string; icon: React.ReactNode }[] = [
    { r: 'feed', label: t('nav.feed'), icon: <HomeIcon /> },
    { r: 'saved', label: t('nav.saved'), icon: <StarIcon /> },
    { r: 'settings', label: t('nav.settings'), icon: <GearIcon /> },
  ]
  return (
    <nav className={`nav ${className ?? ''}`} aria-label={t('nav.menu')}>
      {items.map((i) => (
        <button key={i.r} type="button" onClick={() => go(i.r)} aria-current={route.name === i.r ? 'page' : undefined}>
          {i.icon}
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function Header(props: Props) {
  const { t, go } = props
  return (
    <header className="header">
      <div className="container">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('feed') }}>
          <span className="brand-mark"><BrandIcon /></span>
          {t('appName')}
        </a>
        <span className="spacer" />
        <Nav {...props} />
      </div>
    </header>
  )
}

