import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import type { T } from '../lib/i18n'
import { BackIcon } from './Icons'

type Props = { name: string; href: string | null; t: T; children: ReactNode }

/**
 * One source's stories as a row that scrolls sideways: a swipe on a phone, the arrows or a trackpad on a
 * computer, and the arrow keys once the row has focus. The arrows rest when there is nothing further that way.
 */
export default function SourceRow({ name, href, t, children }: Props) {
  const strip = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: true })

  useEffect(() => {
    const el = strip.current
    if (!el) return
    // a few px of slack: the strip's inner padding and snap can leave it a hair off its ends
    const measure = () => {
      const start = el.scrollLeft <= 4, end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      setEdge((p) => (p.start === start && p.end === end ? p : { start, end }))
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', measure); ro.disconnect() }
  }, [Children.count(children)]) // eslint-disable-line react-hooks/exhaustive-deps

  // A page is the row's visible width, less a little so the last card seen stays as a landmark.
  const page = (dir: 1 | -1) => { const el = strip.current; if (el) el.scrollBy({ left: dir * (el.clientWidth - 80), behavior: 'smooth' }) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); page(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); page(-1) }
  }

  return (
    <section className="src-row" aria-label={name}>
      <div className="src-row-head">
        <h2>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{name}</a> : name}</h2>
        <div className="src-arrows">
          <button type="button" className="icon-btn" aria-label={t('feed.rowPrev')} title={t('feed.rowPrev')} disabled={edge.start} onClick={() => page(-1)}><BackIcon /></button>
          <button type="button" className="icon-btn flip" aria-label={t('feed.rowNext')} title={t('feed.rowNext')} disabled={edge.end} onClick={() => page(1)}><BackIcon /></button>
        </div>
      </div>
      <div className="src-strip" ref={strip} tabIndex={0} role="group" aria-label={name} onKeyDown={onKey}>{children}</div>
    </section>
  )
}
