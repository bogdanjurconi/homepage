import { useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useHashRoute } from './hooks/useHashRoute'
import { makeT } from './lib/i18n'
import { DEFAULT_PROFILE, type Language, type Profile } from './lib/types'
import { readGuestLanguage, setGuestLanguage } from './lib/guestLanguage'
import Header, { BottomNav } from './components/Header'
import Login from './pages/Login'
import Feed from './pages/Feed'
import Saved from './pages/Saved'
import Settings from './pages/Settings'
import Reader from './pages/Reader'

export default function App() {
  const { session, ready } = useAuth()
  const userId = session?.user.id
  const { profile, update, saving } = useProfile(userId)
  const [route, go] = useHashRoute()

  const [guestLang, setGuestLang] = useState<Language>(readGuestLanguage)
  const effective: Profile = profile ?? { id: userId ?? '', ...DEFAULT_PROFILE, language: guestLang }
  const t = useMemo(() => makeT(effective.language), [effective.language])

  if (!ready) return null
  if (!session) return <Login t={t} lang={guestLang} onLanguage={(l) => { setGuestLanguage(l); setGuestLang(l) }} />
  const uid = session.user.id

  return (
    <div className="app">
      <Header t={t} route={route} go={go} />
      <main>
        <div className="container">
          {route.name === 'feed' && <Feed t={t} profile={effective} userId={uid} />}
          {route.name === 'saved' && <Saved t={t} profile={effective} userId={uid} />}
          {route.name === 'settings' && <Settings t={t} profile={effective} update={update} saving={saving} userId={uid} email={session.user.email ?? ''} />}
          {route.name === 'read' && route.param && <Reader t={t} itemId={route.param} userId={uid} />}
        </div>
      </main>
      <BottomNav t={t} route={route} go={go} />
    </div>
  )
}
