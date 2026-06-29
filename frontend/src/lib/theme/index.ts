/**
 * lib/theme/index.ts — Design System Entry Point
 *
 * Import dari sini untuk semua kebutuhan design token:
 *   import { semanticColors, getTheme } from '@/lib/theme'
 *
 * lib/tailwind-theme.ts yang lama TETAP ADA — tidak dihapus.
 * File baru ini adalah "v2" yang akan menggantikan secara bertahap.
 */

export { semanticColors, spacingTokens, typographyTokens } from './tokens'
export type { SemanticColorKey } from './tokens'

export { presets } from './presets'
export type { PresetKey } from './presets'

export { accents } from './accents'
export type { AccentKey } from './accents'

export { statusMappings } from './statusMappings'

// ─── getTheme Helper ──────────────────────────────────────────────────────────

import { presets, type PresetKey } from './presets'
import { accents, type AccentKey } from './accents'
import { semanticColors } from './tokens'

/**
 * getTheme — Menggabungkan preset + accent jadi satu objek siap pakai.
 *
 * @param preset  - 'standard' (default) atau 'soft'
 * @param accent  - 'indigo' (default) atau 'rose'
 * @returns Objek gabungan dengan `.card`, `.button`, `.input`, `.modal`,
 *          `.badge`, `.badgeBase`, `.semantic`, `.surface`, `.accentButton`
 *
 * @example
 * import { getTheme } from '@/lib/theme'
 *
 * // Di page component — ambil theme sekali, pakai di seluruh JSX
 * const t = getTheme('standard', 'indigo')  // default
 * const t = getTheme('soft', 'rose')        // untuk modul bergaya soft/warm
 *
 * // Di JSX:
 * <div className={t.card}>...</div>
 * <button className={`${t.button.base} ${t.accentButton.solid}`}>Simpan</button>
 * <span className={`${t.badge} ${t.semantic.success.bg} ${t.semantic.success.text}`}>
 *   Aktif
 * </span>
 */
export function getTheme(
  preset: PresetKey = 'standard',
  accent: AccentKey = 'indigo',
) {
  const p = presets[preset]
  const a = accents[accent]

  return {
    /** Shape tokens dari preset */
    card:      p.card,
    cardMuted: p.cardMuted,
    input:     p.input,
    tableRow:  p.tableRow,
    divider:   p.divider,
    badge:     p.badge,
    badgePill: p.badgePill,
    badgeBase: p.badgeBase,

    /** Modal */
    modal: {
      overlay: p.overlay,
      panel:   p.modalPanel,
    },

    /** Button (base shape dari preset, warna dari accentButton) */
    button: {
      base:      p.buttonBase,
      secondary: p.buttonSecondary,
      danger:    p.buttonDanger,
    },

    /** Warna accent untuk button (solid / ghost) */
    accentButton: a.button,

    /** Surface tint dari accent */
    surface: a.surface,

    /** Semantic colors — status feedback, tidak tergantung accent */
    semantic: semanticColors,

    /** Radius tokens dari preset */
    radius: p.radius,

    /** Raw refs — kalau butuh akses granular ke preset/accent asli */
    _preset: p,
    _accent: a,
  } as const
}

export type Theme = ReturnType<typeof getTheme>
