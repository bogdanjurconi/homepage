import { useState } from 'react'
import type { T } from '../lib/i18n'
import type { FeedItem, Language } from '../lib/types'
import { timeAgo } from '../lib/time'
import { hrefFor } from '../hooks/useHashRoute'
import { BookIcon, StarIcon } from './Icons'

type Props = {
  item: FeedItem
  sourceName: string
  lang: Language
  t: T
  saved: boolean
  onToggleSave: (item: FeedItem) => void
  showImage: boolean
  openInReader: boolean
  className?: string
}

export default function ArticleCard({ item, sourceName, lang, t, saved, onToggleSave, showImage, openInReader, className }: Props) {
  const [imgOk, setImgOk] = useState(true)
  const readerHref = hrefFor('read', item.id)
  return (
    <article className={`card article ${className ?? ''}`}>
      {showImage && item.image_url && imgOk && (
        <img className="article-img" src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
      )}
      <div className="article-body">
        <div className="article-src">
          <b>{sourceName}</b>
          <span>·</span>
          <time dateTime={item.published_at ?? undefined}>{timeAgo(item.published_at, lang, t('time.now'))}</time>
        </div>
        <h3 className="article-title">
          {openInReader
            ? <a href={readerHref}>{item.title}</a>
            : <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>}
        </h3>
        {item.summary && <p className="article-sum">{item.summary}</p>}
        <div className="article-actions">
          <a className="icon-btn" href={readerHref} aria-label={t('reader.open')} title={t('reader.open')}><BookIcon /></a>
          <button type="button" className="icon-btn" aria-pressed={saved} aria-label={saved ? t('item.unsave') : t('item.save')} title={saved ? t('item.unsave') : t('item.save')} onClick={() => onToggleSave(item)}>
            <StarIcon filled={saved} />
          </button>
        </div>
      </div>
    </article>
  )
}
