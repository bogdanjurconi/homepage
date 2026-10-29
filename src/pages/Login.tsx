import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import type { Language } from '../lib/types'
import { BrandIcon } from '../components/Icons'

type Mode = 'link' | 'password'

export default function Login({ t, lang, onLanguage }: { t: T; lang: Language; onLanguage: (l: Language) => void }) {
  const [mode, setMode] = useState<Mode>('link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending'); setMessage('')
    const address = email.trim().toLowerCase()
    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email: address, password })
      if (error) { setState('error'); setMessage(t(error.status === 400 ? 'login.badPassword' : 'error.generic')) }
      return
    }
    const redirect = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirect, shouldCreateUser: false } })
    if (error) {
      setState('error')
      // With sign-ups disabled, unknown addresses are rejected by Auth; 429 is the one-link-per-minute limit.
      setMessage(/signup|not allowed|not found/i.test(error.message) ? t('login.noAccount') : error.status === 429 ? t('login.wait') : t('error.generic'))
      return
    }
    setState('sent')
  }

  return (
    <div className="container">
      <form className="card login" onSubmit={submit}>
        <div className="login-top">
          <span className="brand"><span className="brand-mark"><BrandIcon /></span>{t('appName')}</span>
          <div className="seg seg-small" role="group" aria-label={t('settings.language')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => onLanguage('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'ro'} onClick={() => onLanguage('ro')}>RO</button>
          </div>
        </div>
        {state === 'sent' ? (
          <>
            <h1>{t('login.sentTitle')}</h1>
            <p>{t('login.sent', { email: email.trim() })}</p>
            <button type="button" className="btn ghost" onClick={() => setState('idle')}>{t('login.again')}</button>
          </>
        ) : (
          <>
            <h1>{t('login.title')}</h1>
            {mode === 'link' && <p className="muted">{t('login.lead')}</p>}
            <label className="field">
              <span>{t('login.email')}</span>
              <input className="input" type="email" name="email" autoComplete="email" inputMode="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode === 'password' && (
              <label className="field">
                <span>{t('login.password')}</span>
                <input className="input" type="password" name="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            {state === 'error' && <div className="msg error">{message || t('error.generic')}</div>}
            {mode === 'password' && <p className="muted">{t('login.forgot')}</p>}
            <button className="btn primary" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? t('login.sending') : mode === 'password' ? t('login.signIn') : t('login.send')}
            </button>
            <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'link' ? 'password' : 'link'); setState('idle') }}>
              {mode === 'link' ? t('login.usePassword') : t('login.useLink')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
