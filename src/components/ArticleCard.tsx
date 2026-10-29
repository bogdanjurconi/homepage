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
  showSummary: boolean
  className?: string
  // Compact list: on a phone, source, time and buttons sit on the picture, so the row is only picture and headline.
  compact?: boolean
}

export default function ArticleCard({ item, sourceName, lang, t, saved, onToggleSave, showImage, openInReader, showSummary, className, compact }: Props) {
  const [imgOk, setImgOk] = useState(true)
  const readerHref = hrefFor('read', item.id)
  const hasImage = showImage && !!item.image_url && imgOk
  const img = hasImage && (
    <img className="article-img" src={item.image_url!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
  )
  const src = (
    <div className="article-src">
      <b>{sourceName}</b>
      <span>·</span>
      <time dateTime={item.published_at ?? undefined}>{timeAgo(item.published_at, lang, t('time.now'))}</time>
    </div>
  )
  const actions = (
    <div className="article-actions">
      <a className="icon-btn" href={readerHref} aria-label={t('reader.open')} title={t('reader.open')}><BookIcon /></a>
      <button type="button" className="icon-btn" aria-pressed={saved} aria-label={saved ? t('item.unsave') : t('item.save')} title={saved ? t('item.unsave') : t('item.save')} onClick={() => onToggleSave(item)}>
        <StarIcon filled={saved} />
      </button>
    </div>
  )
  const onPicture = compact && hasImage
  return (
    <article className={`card article ${className ?? ''}`}>
      {onPicture ? <div className="article-media">{img}{src}{actions}</div> : img}
      <div className="article-body">
        <h3 className="article-title">
          {openInReader
            ? <a href={readerHref}>{item.title}</a>
            : <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>}
        </h3>
        {showSummary && item.summary && <p className="article-sum">{item.summary}</p>}
        {/* with a picture in the compact list, CSS shows this foot or the copy on the picture depending on the width */}
        <div className="article-foot">{src}{actions}</div>
      </div>
    </article>
  )
}
