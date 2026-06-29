/**
 * tokens.ts — Layer 1: Base Semantic Tokens
 *
 * Warna muted/desaturated, bukan Tailwind defaults yang terlalu vibrant.
 * Basis referensi:
 *   success  → emerald muted  (#3F8F6F basis → emerald-700/50/200)
 *   warning  → amber muted   (#B8893A basis → amber-700/50/200)
 *   danger   → red muted     (#b91c1c basis → red-700/50/200)
 *              SENGAJA red, BUKAN rose — supaya tidak tabrakan dengan
 *              accent.rose yang dipakai sebagai warna brand/tema modul.
 *   info     → indigo muted  (#5B5FBF basis → indigo-700/50/200)
 *   neutral  → slate standar (slate-700/100/200)
 *
 * TIDAK menggantikan lib/tailwind-theme.ts — file lama tetap ada untuk
 * backward compatibility sampai migrasi per-feature selesai.
 */

// ─── Semantic Color Tokens ───────────────────────────────────────────────────

export const semanticColors = {
  /**
   * success — Hijau muted. Basis emerald-700 (#047857).
   * Lebih hangat dan kurang "neon" dari green-500.
   */
  success: {
    bg:         'bg-emerald-50',
    bgDark:     'dark:bg-emerald-900/15',
    border:     'border-emerald-200',
    borderDark: 'dark:border-emerald-800/60',
    text:       'text-emerald-700',
    textDark:   'dark:text-emerald-400',
    icon:       'text-emerald-600',
    iconDark:   'dark:text-emerald-500',
  },

  /**
   * warning — Amber muted. Basis amber-700 (#b45309).
   * Kurang kuning-neon, lebih ke oker/emas.
   */
  warning: {
    bg:         'bg-amber-50',
    bgDark:     'dark:bg-amber-900/15',
    border:     'border-amber-200',
    borderDark: 'dark:border-amber-800/60',
    text:       'text-amber-700',
    textDark:   'dark:text-amber-400',
    icon:       'text-amber-600',
    iconDark:   'dark:text-amber-500',
  },

  /**
   * danger — Red muted. Basis red-700 (#b91c1c).
   * red-700 tetap terasa tegas sebagai sinyal error tapi tidak "neon" seperti
   * red-500 (#ef4444). Family red dipilih secara sengaja — BUKAN rose — supaya
   * tidak tabrakan dengan accent.rose yang dipakai sebagai warna brand/tema
   * (contoh: AP Payments). User harus bisa membedakan "ini sinyal error" vs
   * "ini warna identitas modul".
   */
  danger: {
    bg:         'bg-red-50',
    bgDark:     'dark:bg-red-900/15',
    border:     'border-red-200',
    borderDark: 'dark:border-red-800/60',
    text:       'text-red-700',
    textDark:   'dark:text-red-400',
    icon:       'text-red-600',
    iconDark:   'dark:text-red-500',
  },

  /**
   * info — Indigo muted. Basis indigo-700 (#4338ca), bukan blue-600.
   * Membedakan status "informasional" dari primary action (yang juga biru).
   */
  info: {
    bg:         'bg-indigo-50',
    bgDark:     'dark:bg-indigo-900/15',
    border:     'border-indigo-200',
    borderDark: 'dark:border-indigo-800/60',
    text:       'text-indigo-700',
    textDark:   'dark:text-indigo-400',
    icon:       'text-indigo-600',
    iconDark:   'dark:text-indigo-500',
  },

  /**
   * neutral — Slate standar. Untuk status yang belum/tidak memiliki
   * konotasi positif/negatif (draft, inactive, unknown, dll).
   */
  neutral: {
    bg:         'bg-slate-100',
    bgDark:     'dark:bg-slate-800/50',
    border:     'border-slate-200',
    borderDark: 'dark:border-slate-700',
    text:       'text-slate-600',
    textDark:   'dark:text-slate-400',
    icon:       'text-slate-500',
    iconDark:   'dark:text-slate-400',
  },
} as const

export type SemanticColorKey = keyof typeof semanticColors

// ─── Spacing Tokens (ported dari tailwind-theme.ts, tidak diubah) ────────────

export const spacingTokens = {
  /** Gap utilities */
  xs:   'gap-1',   // 4px
  sm:   'gap-2',   // 8px
  md:   'gap-3',   // 12px
  base: 'gap-4',   // 16px
  lg:   'gap-6',   // 24px
  xl:   'gap-8',   // 32px

  /** Section-level spacing */
  section:      'mb-8 lg:mb-10',
  itemGap:      'gap-4',
  itemVertical: 'space-y-4',

  /** Padding standards — dipakai oleh presets */
  cardPadding:   'p-4 sm:p-6',
  buttonPadding: 'px-4 py-2.5',
  badgePadding:  'px-2.5 py-1',
  modalPadding:  'p-6 sm:p-8',
} as const

// ─── Typography Tokens (ported dari tailwind-theme.ts, tidak diubah) ─────────

export const typographyTokens = {
  display:    'text-3xl font-bold leading-tight',
  heading:    'text-xl font-semibold leading-snug',
  subheading: 'text-base font-semibold',
  body:       'text-sm leading-relaxed',
  label:      'text-xs font-semibold uppercase tracking-wide',
  caption:    'text-xs text-slate-500 dark:text-slate-400',
} as const
