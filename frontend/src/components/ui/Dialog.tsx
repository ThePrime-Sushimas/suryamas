import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { typographyTokens } from '@/lib/theme'
import { useTheme } from './ThemeProvider'
import {
  focusFirstFocusable,
  useFocusTrap,
} from './_dialogFocusTrap'
import {
  getZIndex,
  isTopDialog,
  registerDialog,
  subscribeDialogStack,
  getDialogStackSnapshot,
} from './_dialogStack'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

export interface DialogProps {
  isOpen:     boolean
  onClose:    () => void
  size?:      DialogSize
  /**
   * true → blokir close via Escape dan klik backdrop (serta tombol × di Header).
   * TIDAK memblokir onClose() yang dipanggil eksplisit dari Footer/dll.
   */
  preventClose?: boolean
  /** Untuk dialog tanpa Dialog.Header — aksesibilitas */
  'aria-label'?: string
  children?:  ReactNode
  className?: string
}

interface DialogContextValue {
  onClose:       () => void
  preventClose:  boolean
  titleId:       string | undefined
}

// ─── Size map ─────────────────────────────────────────────────────────────────
// max-w-* tidak ada di preset — satu-satunya sumber lebar panel

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

// Padding section — dari spacingTokens.modalPadding (px/py split untuk layout flex)
const HEADER_PAD = 'px-6 sm:px-8 pt-6 sm:pt-8 pb-4'
const BODY_PAD   = 'px-6 sm:px-8 py-4'
const FOOTER_PAD = 'px-6 sm:px-8 py-4 sm:py-6'

// ─── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialogContext(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('Dialog compound components must be used inside <Dialog>')
  }
  return ctx
}

function useDialogStackSync(): void {
  useSyncExternalStore(subscribeDialogStack, getDialogStackSnapshot, () => '')
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function Dialog({
  isOpen,
  onClose,
  size = 'md',
  preventClose = false,
  'aria-label': ariaLabel,
  children,
  className = '',
}: DialogProps) {
  const t = useTheme()
  const instanceId = useId()
  const titleId    = `${instanceId}-title`

  const panelRef = useRef<HTMLDivElement>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const preventCloseRef = useRef(preventClose)
  preventCloseRef.current = preventClose

  useDialogStackSync()

  const isTop = isOpen && isTopDialog(instanceId)
  const zIndex = getZIndex(instanceId)

  useFocusTrap(panelRef, isTop)

  useEffect(() => {
    if (!isOpen) return

    const unregister = registerDialog({
      id: instanceId,
      onClose: () => onCloseRef.current(),
      preventCloseRef,
    })

    requestAnimationFrame(() => {
      if (panelRef.current) {
        focusFirstFocusable(panelRef.current)
      }
    })

    return unregister
  }, [isOpen, instanceId])

  if (!isOpen) return null

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (!isTopDialog(instanceId)) return
    if (preventCloseRef.current) return
    onCloseRef.current()
  }

  const overlayClasses = t.modal.overlay
  const panelClasses = [
    t.modal.panel,
    SIZE_CLASSES[size],
    'flex flex-col max-h-[calc(100dvh-2rem)]',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <DialogContext.Provider
      value={{
        onClose: () => onCloseRef.current(),
        preventClose,
        titleId,
      }}
    >
      <div
        className={overlayClasses}
        style={{ zIndex }}
        onMouseDown={handleBackdropMouseDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
      >
        <div
          ref={panelRef}
          className={panelClasses}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>,
    document.body,
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

export interface DialogHeaderProps {
  children?:  ReactNode
  className?: string
  /** Sembunyikan tombol × (default: tampil) */
  hideClose?: boolean
}

function DialogHeader({
  children,
  className = '',
  hideClose = false,
}: DialogHeaderProps) {
  const t = useTheme()
  const { onClose, preventClose, titleId } = useDialogContext()

  return (
    <div
      className={[
        'flex shrink-0 items-start justify-between gap-4',
        'border-b',
        t.divider,
        HEADER_PAD,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children != null && (
        <h2
          id={titleId}
          className={`flex-1 text-gray-900 dark:text-white ${typographyTokens.subheading}`}
        >
          {children}
        </h2>
      )}

      {!hideClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={preventClose}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-slate-300"
          aria-label="Tutup dialog"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export interface DialogBodyProps {
  children?:  ReactNode
  className?: string
}

function DialogBody({ children, className = '' }: DialogBodyProps) {
  return (
    <div
      className={['min-h-0 flex-1 overflow-y-auto', BODY_PAD, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export interface DialogFooterProps {
  children?:  ReactNode
  className?: string
}

function DialogFooter({ children, className = '' }: DialogFooterProps) {
  const t = useTheme()

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-end gap-3',
        'border-t',
        t.divider,
        FOOTER_PAD,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

// ─── Compound export ──────────────────────────────────────────────────────────

Dialog.Header = DialogHeader
Dialog.Body   = DialogBody
Dialog.Footer = DialogFooter
