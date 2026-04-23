import { useEffect, useRef, RefObject } from 'react'

/**
 * Appelle `handler` quand un clic ou un touch se produit en dehors de `ref`.
 * N'enregistre les listeners que si `enabled` est true.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  enabled = true
): void {
  // Garde le handler à jour sans le mettre en dépendance de l'effet
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handlerRef.current()
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, enabled])
}
