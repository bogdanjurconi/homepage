import type { Language } from './types'

// Language chosen on the login page, before there is a profile. Applied to the profile after sign-in.
const KEY = 'homepage.lang'
const PENDING = 'homepage.lang.pending'

export function readGuestLanguage(): Language {
  const v = localStorage.getItem(KEY)
  return v === 'ro' || v === 'en' ? v : 'en'
}

export function setGuestLanguage(lang: Language) {
  localStorage.setItem(KEY, lang)
  localStorage.setItem(PENDING, lang)
}

export function takePendingLanguage(): Language | null {
  const v = localStorage.getItem(PENDING)
  localStorage.removeItem(PENDING)
  return v === 'ro' || v === 'en' ? v : null
}
