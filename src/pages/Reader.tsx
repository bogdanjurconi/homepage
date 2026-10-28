import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { ReaderArticle } from '../lib/types'
import { useSaved } from '../hooks/useSaved'
import { BackIcon, ExternalIcon, StarIcon } from '../components/Icons'

const cacheKey = (id: string) => `homepage.reader.${id}`

export default function Reader({ t, itemId, userId }: { t: T; itemId: string; userId: string }) {
  const [article, setArticle] = useState<ReaderArticle | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(cacheKey(itemId)) ?? 'null') } catch { return null }
  })
  const [error, setError] = useState(false)
  const [fallbackLink, setFallbackLink] = useState<string | null>(null)
  const { savedIds, toggle } = useSaved(userId)

  useEffect(() => {
    if (article) return
    let cancelled = false
    supabase.functions.invoke<ReaderArticle>('reader', { body: { item_id: itemId } }).then(async ({ data, error: err }) => {
      if (cancelled) return
      if (err || !data || 'error' in data) {
        setError(true)
        const { data: item } = await supabase.from('feed_items').select('link').eq('id', itemId).maybeSingle()
        if (item) setFallbackLink(item.link)
        return
      }
      try { sessionStorage.setItem(cacheKey(itemId), JSON.stringify(data)) } catch { /* storage full: ignore */ }
      setArticle(data)
    })
    return () => { cancelled = true }
  }, [itemId, article])

  const back = () => (window.history.length > 1 ? window.history.back() : window.location.assign('#/'))
  const siteUrl = article?.url ?? fallbackLink

  return (
    <div className="reader">
      <div className="reader-bar">
        <button type="button" className="btn ghost" onClick={back}><BackIcon /> {t('reader.back')}</button>
        <span className="spacer" />
        <button type="button" className="icon-btn" aria-pressed={savedIds.has(itemId)} aria-label={t('item.save')}
          onClick={() => toggle({ id: itemId, feed_url: '', title: article?.title ?? '', link: siteUrl ?? '', summary: null, image_url: null, published_at: null })}>
          <StarIcon filled={savedIds.has(itemId)} />
        </button>
        {siteUrl && <a className="btn" href={siteUrl} target="_blank" rel="noopener noreferrer"><ExternalIcon /> {t('reader.openSite')}</a>}
      </div>

      {error && <div className="msg error">{t('reader.error')}</div>}
      {!article && !error && <p className="muted">{t('reader.loading')}</p>}

      {article && (
        <article className="card reader-body">
          <h1>{article.title}</h1>
          <div className="reader-meta">
            {article.site_name}{article.byline ? ` · ${t('reader.by', { name: article.byline })}` : ''}
          </div>
          {article.image_url && !article.content.includes('<img') && (
            <img className="reader-hero" src={article.image_url} alt="" referrerPolicy="no-referrer" />
          )}
          <div className="reader-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content, { FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button'], ADD_ATTR: ['target'] }) }} />
        </article>
      )}
    </div>
  )
}
