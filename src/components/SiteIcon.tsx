import { useState } from 'react'
import { hostname } from '../lib/time'

// A site's icon, as sharp as the site offers. First Google's favicon service at 64px; when that only has a tiny
// favicon (it comes back at 16px), the site's own apple-touch-icon (57-180px, most sites have one); when neither
// is sharp, the small favicon itself, drawn at its own size rather than blown up. A letter on a colour from the
// name is the last resort, for sites with no icon at all.
const sources = (url: string) => {
  const host = hostname(url)
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
    `https://${host}/apple-touch-icon.png`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`,
  ]
}

function hueOf(name: string): number {
  let h = 0
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export default function SiteIcon({ url, name, className }: { url: string; name: string; className?: string }) {
  const [step, setStep] = useState(0)
  const [shown, setShown] = useState<'loading' | 'sharp' | 'small' | 'letter'>('loading')
  const list = sources(url)
  const next = () => (step + 1 < list.length ? setStep(step + 1) : setShown('letter'))
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  if (shown === 'letter') return (
    <span className={`site-icon letter ${className ?? ''}`} aria-hidden="true" style={{ '--site-hue': hueOf(name) } as React.CSSProperties}>{letter}</span>
  )
  return (
    <span className={`site-icon ${shown === 'small' ? 'small' : ''} ${className ?? ''}`} aria-hidden="true">
      <img key={step} src={list[step]} alt="" loading="lazy" referrerPolicy="no-referrer"
        style={shown === 'loading' ? { opacity: 0 } : undefined}
        onLoad={(e) => {
          const w = e.currentTarget.naturalWidth
          if (w >= 32) setShown('sharp')
          else if (step === list.length - 1) setShown(w > 0 ? 'small' : 'letter')
          else next()
        }}
        onError={next} />
    </span>
  )
}
