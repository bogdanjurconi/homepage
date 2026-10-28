import { useState, type FormEvent } from 'react'
import type { T } from '../lib/i18n'
import type { SearchEngine } from '../lib/types'
import { SearchIcon } from './Icons'

const ENGINES: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
}

export default function SearchBar({ engine, t }: { engine: SearchEngine; t: T }) {
  const [q, setQ] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    window.location.assign(ENGINES[engine] + encodeURIComponent(query))
  }
  return (
    <form className="search" role="search" onSubmit={submit}>
      <SearchIcon className="search-icon" />
      <input className="search-input" type="search" name="q" placeholder={t('search.placeholder')} aria-label={t('search.placeholder')}
        value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
      <button className="btn primary" type="submit">{t('search.go')}</button>
    </form>
  )
}
