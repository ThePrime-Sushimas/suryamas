import { forwardRef, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useTheme } from './ThemeProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant
  size?:      ButtonSize
  loading?:   boolean
  leftIcon?:  ReactNode
  rightIcon?: ReactNode
  children?:  ReactNode
}

// ─── Size Classes ─────────────────────────────────────────────────────────────
// Padding (px-*/py-*), gap, dan font-size (text-*) TIDAK ada di preset —
// disuplai sepenuhnya dari sini. Tidak ada konflik utility class:
//   preset  → shape (rounded-*), weight (font-*), color, transition, focus
//   SIZE_CLASSES → padding, gap, font-size
// md unified ke py-2 untuk semua preset (standard dan soft).

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant  = 'primary',
      size     = 'md',
      loading  = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const t = useTheme()

    // ── Pilih base classes dari variant ──────────────────────────────────────
    // Tidak ada padding/gap/font-size di base classes — preset sudah bersih.
    let baseClasses: string
    switch (variant) {
      case 'secondary':
        baseClasses = t.button.secondary
        break
      case 'danger':
        baseClasses = t.button.danger
        break
      case 'ghost':
        // ghost = shape dari buttonBase + warna ghost dari accent
        baseClasses = `${t.button.base} ${t.accentButton.ghost}`
        break
      case 'primary':
      default:
        // primary = shape dari buttonBase + warna solid dari accent
        baseClasses = `${t.button.base} ${t.accentButton.solid}`
        break
    }

    // ── Gabungkan semua classes ───────────────────────────────────────────────
    // Urutan: base (shape+color) → size (padding+gap+font) → caller override
    const classes = [baseClasses, SIZE_CLASSES[size], className]
      .filter(Boolean)
      .join(' ')

    // ── Icon handling ─────────────────────────────────────────────────────────
    // Loading: ganti leftIcon dengan spinner, sembunyikan rightIcon
    const leadingIcon = loading
      ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      : leftIcon
        ? <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
        : null

    const trailingIcon = rightIcon && !loading
      ? <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
      : null

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {leadingIcon}
        {children && <span>{children}</span>}
        {trailingIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
