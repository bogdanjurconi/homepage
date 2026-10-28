import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { T } from '../lib/i18n'
import { HomeIcon } from '../components/Icons'

export default function Login({ t }: { t: T }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const redirect = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } })
    if (error) { setState('error'); setMessage(error.message); return }
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
            <p className="muted">{t('login.lead')}</p>
            <label className="field">
              <span>{t('login.email')}</span>
              <input className="input" type="email" name="email" autoComplete="email" inputMode="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {state === 'error' && <div className="msg error">{message || t('error.generic')}</div>}
            <button className="btn primary" type="submit" disabled={state === 'sending' || !email}>
              {state === 'sending' ? t('login.sending') : t('login.send')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
