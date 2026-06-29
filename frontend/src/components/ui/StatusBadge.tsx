import { createElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { semanticColors, type SemanticColorKey } from '@/lib/theme'
import { useTheme } from './ThemeProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusBadgeVariant = SemanticColorKey
export type StatusBadgeSize    = 'sm' | 'md'

export interface StatusBadgeProps {
  variant:    StatusBadgeVariant
  label:      string
  size?:      StatusBadgeSize
  /**
   * Komponen icon Lucide — HARUS component reference, BUKAN elemen JSX.
   * Benar:  icon={XCircle}
   * Salah:  icon={<XCircle />}  icon={<XCircle className="w-4 h-4" />}
   *
   * StatusBadge mengontrol ukuran icon via ICON_SIZE[size] supaya konsisten
   * di semua lokasi migrasi — developer tidak perlu className manual.
   */
  icon?:      LucideIcon
  className?: string
}

// ─── Size map ─────────────────────────────────────────────────────────────────
// padding, gap, text-size TIDAK ada di preset — disuplai sepenuhnya dari sini

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
}

const ICON_SIZE: Record<StatusBadgeSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusBadge({
  variant,
  label,
  size = 'md',
  icon,
  className = '',
}: StatusBadgeProps) {
  const t = useTheme()
  const c = semanticColors[variant]

  const badgeClasses = [
    t.badgeBase,
    SIZE_CLASSES[size],
    'rounded-full',
    c.bg,
    c.bgDark,
    c.border,
    c.borderDark,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const labelClasses = [c.text, c.textDark].filter(Boolean).join(' ')
  const iconClasses  = [c.icon, c.iconDark].filter(Boolean).join(' ')

  return (
    <span className={badgeClasses}>
      {icon != null && (
        <span className={`inline-flex shrink-0 ${iconClasses}`} aria-hidden="true">
          {createElement(icon, { className: ICON_SIZE[size] })}
        </span>
      )}
      <span className={labelClasses}>{label}</span>
    </span>
  )
}
