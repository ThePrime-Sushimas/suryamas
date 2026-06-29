/**
 * Focus trap untuk dialog teratas — Tab/Shift+Tab tidak keluar dari panel.
 *
 * TIDAK mengatur initial focus atau focus restore — itu tanggung jawab
 * _dialogStack (restore per-instance) dan Dialog root (initial focus saat buka).
 *
 * Internal module; tidak di-export dari barrel index.
 */

import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

export function focusFirstFocusable(container: HTMLElement): void {
  const focusables = getFocusableElements(container)
  if (focusables.length > 0) {
    focusables[0].focus()
    return
  }
  if (!container.hasAttribute('tabindex')) {
    container.setAttribute('tabindex', '-1')
  }
  container.focus()
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  useEffect(() => {
    if (!isActive) return
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusables = getFocusableElements(container)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, containerRef])
}
