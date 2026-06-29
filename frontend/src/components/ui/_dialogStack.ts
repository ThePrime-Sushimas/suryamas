/**
 * Global dialog stack — scroll lock, z-index layering, Escape-to-close (top only).
 *
 * Internal module; tidak di-export dari barrel index.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DialogStackEntry {
  id: string
  /** Selalu memanggil handler terbaru via ref di komponen Dialog */
  onClose: () => void
  /**
   * Ref object yang DISET SENDIRI per instance Dialog — bukan snapshot boolean.
   * Escape handler membaca .current saat event terjadi (hindari stale closure).
   */
  preventCloseRef: { current: boolean }
  zIndex: number
  /**
   * Elemen yang aktif tepat SEBELUM dialog ini dibuka — disimpan per-id di entry,
   * bukan variabel module-level tunggal. Restore hanya saat entry ini di-unregister.
   */
  previousActiveElement: HTMLElement | null
}

// ─── Module state ─────────────────────────────────────────────────────────────

const BASE_Z = 50

const stack: DialogStackEntry[] = []
let savedBodyOverflow = ''
let escapeListenerAttached = false

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (!top) return
  if (top.preventCloseRef.current) return
  e.preventDefault()
  e.stopPropagation()
  top.onClose()
}

function attachEscapeListener() {
  if (escapeListenerAttached) return
  document.addEventListener('keydown', handleEscapeKey)
  escapeListenerAttached = true
}

function detachEscapeListener() {
  if (!escapeListenerAttached) return
  document.removeEventListener('keydown', handleEscapeKey)
  escapeListenerAttached = false
}

function lockBodyScroll() {
  savedBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  document.body.style.overflow = savedBodyOverflow
}

function restoreFocus(el: HTMLElement | null) {
  if (!el || !document.contains(el)) return
  try {
    el.focus({ preventScroll: true })
  } catch {
    el.focus()
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function subscribeDialogStack(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDialogStackSnapshot(): string {
  if (stack.length === 0) return ''
  return stack.map((e) => e.id).join(',')
}

export function registerDialog(
  entry: Omit<DialogStackEntry, 'zIndex' | 'previousActiveElement'> & {
    previousActiveElement?: HTMLElement | null
  },
): () => void {
  const active = document.activeElement
  const previousActiveElement =
    entry.previousActiveElement ??
    (active instanceof HTMLElement ? active : null)

  const fullEntry: DialogStackEntry = {
    ...entry,
    zIndex: BASE_Z + stack.length,
    previousActiveElement,
  }

  if (stack.length === 0) {
    lockBodyScroll()
    attachEscapeListener()
  }

  stack.push(fullEntry)
  notify()

  return () => unregisterDialog(entry.id)
}

export function unregisterDialog(id: string): void {
  const index = stack.findIndex((e) => e.id === id)
  if (index === -1) return

  const [entry] = stack.splice(index, 1)

  if (stack.length === 0) {
    unlockBodyScroll()
    detachEscapeListener()
  }

  notify()

  // Restore fokus milik instance INI — bukan dialog lain di stack
  requestAnimationFrame(() => {
    restoreFocus(entry.previousActiveElement)
  })
}

export function isTopDialog(id: string): boolean {
  return stack[stack.length - 1]?.id === id
}

export function getZIndex(id: string): number {
  return stack.find((e) => e.id === id)?.zIndex ?? BASE_Z
}
