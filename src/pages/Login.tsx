import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import { HomeIcon } from '../components/Icons'

type Mode = 'link' | 'password'

export default function Login({ t }: { t: T }) {
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
      if (error) { setState('error'); setMessage(error.status === 400 ? t('login.badPassword') : error.message) }
      return
    }
    const redirect = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirect, shouldCreateUser: false } })
    if (error) {
      setState('error')
      // With sign-ups disabled, unknown addresses are rejected by Auth.
      setMessage(/signup|not allowed|not found/i.test(error.message) ? t('login.noAccount') : error.message)
      return
    }
    setState('sent')
  }

  return (
    <div className="container">
      <form className="card login" onSubmit={submit}>
        <span className="brand-mark"><HomeIcon /></span>
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
            <button className="btn primary" type="submit" disabled={state === 'sending' || !email || (mode === 'password' && !password)}>
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
