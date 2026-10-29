import { useSyncExternalStore } from 'react'

/** Whether a media query matches, following changes (a phone turned sideways, a window resized). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
