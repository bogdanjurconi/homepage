import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useHashRoute } from './hooks/useHashRoute'
import { makeT } from './lib/i18n'
import { DEFAULT_PROFILE, type Language, type Profile } from './lib/types'
import { readGuestLanguage, setGuestLanguage } from './lib/guestLanguage'
import Header from './components/Header'
import Feed from './pages/Feed'

// The front page ships in the first bundle; the other pages load when opened (Settings is the largest,
// the reader brings its sanitizer), and are fetched during idle time so the first tap on them is instant.
const Login = lazy(() => import('./pages/Login'))
const Saved = lazy(() => import('./pages/Saved'))
const Settings = lazy(() => import('./pages/Settings'))
const Reader = lazy(() => import('./pages/Reader'))

export default function App() {
  const { session, ready } = useAuth()
  const userId = session?.user.id
  const { profile, update, saving, saveError } = useProfile(userId)
  const [route, go] = useHashRoute()

  const [guestLang, setGuestLang] = useState<Language>(readGuestLanguage)
  const effective: Profile = profile ?? { id: userId ?? '', ...DEFAULT_PROFILE, language: guestLang }
  const t = useMemo(() => makeT(effective.language), [effective.language])
  useEffect(() => { document.documentElement.lang = effective.language }, [effective.language])
  useEffect(() => {
    if (!session) return
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    idle(() => { void import('./pages/Settings'); void import('./pages/Reader'); void import('./pages/Saved') })
  }, [session])

  if (!ready) return null
  if (!session) return <Suspense fallback={null}><Login t={t} lang={guestLang} onLanguage={(l) => { setGuestLanguage(l); setGuestLang(l) }} /></Suspense>
  const uid = session.user.id

  return (
    <div className="app">
      <Header t={t} route={route} go={go} />
      <main>
        <div className="container">
          <Suspense fallback={null}>
            {route.name === 'feed' && <Feed t={t} profile={effective} userId={uid} />}
            {route.name === 'saved' && <Saved t={t} profile={effective} userId={uid} />}
            {route.name === 'settings' && <Settings t={t} profile={effective} update={update} saving={saving} saveError={saveError} userId={uid} email={session.user.email ?? ''} sub={route.param} />}
            {/* keyed by the story, so going from one article straight to another starts fresh */}
            {route.name === 'read' && route.param && <Reader key={route.param} t={t} itemId={route.param} userId={uid} />}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
