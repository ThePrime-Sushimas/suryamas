// presets.ts — Layer 2: Style Presets
//
// Dua preset look & feel yang LEPAS dari warna (warna disuplai dari accents.ts):
//
//   standard — rounded-lg, shadow netral, border tipis, solid button.
//              Default untuk semua modul baru.
//
//   soft     — rounded-2xl, border lebih tebal, warm tint background.
//              Diekstrak dari pola ap-payments.theme.ts.
//              GRADIENT DIHAPUS → solid bg saja.
//              SHADOW BERWARNA DIHAPUS → shadow-sm netral saja.
//
// Setiap preset hanya mendefinisikan shape/spacing/shadow — BUKAN warna.
// Warna accent disuplai dari lib/theme/accents.ts dan digabungkan
// oleh getTheme() di lib/theme/index.ts.
//
// Catatan button strings:
//   padding (px-N/py-N), gap, dan font-size (text-N) SENGAJA tidak ada di sini.
//   Ketiganya disuplai sepenuhnya oleh Button.tsx via SIZE_CLASSES supaya
//   tidak ada konflik Tailwind utility class antar sumber.
//   Yang tersisa di preset: shape (rounded-N), weight (font-N),
//   color (bg-N/text-N/border-N), transition, focus, disabled, active.
//
// Catatan input string:
//   px-N (padding-x), border-color, dan focus:ring/border-color SENGAJA tidak ada.
//   Disuplai oleh Input/Textarea/Select via conditional (icon state + error state).
//   Yang tersisa: w-full, py-N (vertical padding), border (width only), radius,
//   bg, text-color, placeholder, transition, focus:outline-none focus:ring-2
//   (ring-width only), disabled states.
//
// Catatan badge strings:
//   gap-N, padding (px-N/py-N), text-size (text-xs), dan radius SENGAJA tidak ada
//   di badgeBase. Disuplai oleh StatusBadge.tsx via SIZE_CLASSES + rounded-full,
//   atau oleh susunan badge/badgePill untuk backward compat langsung.
//   Yang tersisa di badgeBase: inline-flex, items-center, border, font-medium.

// ─── Preset Standard ─────────────────────────────────────────────────────────

const standardBadgeBase = 'inline-flex items-center border font-medium'

const standard = {
  /**
   * Radius system
   * card/modal/input → rounded-lg (8px)
   * button/badge     → rounded-md (6px)
   */
  radius: {
    card:   'rounded-lg',
    modal:  'rounded-lg',
    input:  'rounded-lg',
    button: 'rounded-md',
    badge:  'rounded-md',
  },

  /** Card */
  card: [
    'bg-white dark:bg-gray-800',
    'rounded-lg',
    'border border-slate-200 dark:border-slate-700',
    'shadow-sm hover:shadow-md',
    'transition-shadow duration-150',
  ].join(' '),

  cardMuted: [
    'bg-slate-50 dark:bg-gray-800/60',
    'rounded-lg',
    'border border-slate-200 dark:border-slate-700',
    'shadow-sm',
  ].join(' '),

  // buttonBase — shape + behavior only.
  // TIDAK ADA: px-N/py-N (padding), gap-N, text-N (font-size).
  // Disuplai oleh Button.tsx SIZE_CLASSES.
  buttonBase: [
    'inline-flex items-center justify-center',
    'rounded-md',
    'font-semibold',
    'transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
  ].join(' '),

  // buttonSecondary — shape + color only.
  // TIDAK ADA: px-N/py-N (padding), gap-N, text-N (font-size).
  buttonSecondary: [
    'inline-flex items-center justify-center',
    'rounded-md',
    'bg-slate-100 dark:bg-slate-700',
    'hover:bg-slate-200 dark:hover:bg-slate-600',
    'text-slate-700 dark:text-slate-200',
    'font-semibold',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600',
  ].join(' '),

  // buttonDanger — shape + color only.
  // TIDAK ADA: px-N/py-N (padding), gap-N, text-N (font-size).
  buttonDanger: [
    'inline-flex items-center justify-center',
    'rounded-md',
    'bg-red-600 hover:bg-red-700',
    'text-white',
    'font-semibold',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
  ].join(' '),

  // input — shape/bg/transition/disabled only.
  // TIDAK ADA: px-N (padding-x), border-color, focus:ring/border-color.
  // Disuplai oleh Input/Textarea/Select via _inputColors + icon conditional.
  input: [
    'w-full py-2',
    'border',
    'rounded-lg',
    'bg-white dark:bg-gray-700',
    'text-sm text-gray-900 dark:text-white',
    'placeholder:text-slate-400 dark:placeholder:text-slate-500',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-2',
    'disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed',
  ].join(' '),

  /** Modal overlay + panel */
  overlay: [
    'fixed inset-0 z-50',
    'flex items-center justify-center p-4',
    'bg-black/40 dark:bg-black/60',
    'backdrop-blur-sm',
  ].join(' '),

  modalPanel: [
    'relative w-full',
    'bg-white dark:bg-gray-800',
    'rounded-lg shadow-xl',
    'border border-slate-200 dark:border-slate-700',
  ].join(' '),

  // badgeBase — shape only, tanpa gap/padding/text-size/radius.
  badgeBase: standardBadgeBase,

  /** Badge */
  badge: [
    standardBadgeBase,
    'gap-1',
    'px-2 py-0.5',
    'rounded-md',
    'text-xs',
  ].join(' '),

  badgePill: [
    standardBadgeBase,
    'gap-1',
    'px-2.5 py-1',
    'rounded-full',
    'text-xs',
  ].join(' '),

  /** Table row hover */
  tableRow: 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-100',

  /** Divider */
  divider: 'border-slate-200 dark:border-slate-700',
} as const

// ─── Preset Soft ─────────────────────────────────────────────────────────────

const softBadgeBase = 'inline-flex items-center border font-medium'

const soft = {
  /**
   * Radius system
   * card/modal → rounded-2xl (16px)
   * button/input/badge → rounded-xl (12px)
   */
  radius: {
    card:   'rounded-2xl',
    modal:  'rounded-2xl',
    input:  'rounded-xl',
    button: 'rounded-xl',
    badge:  'rounded-lg',
  },

  /** Card — border lebih tebal (border-2) sesuai karakter soft */
  card: [
    'bg-white dark:bg-gray-800',
    'rounded-2xl',
    'border-2 border-slate-200 dark:border-slate-600',
    'shadow-sm',
    'transition-shadow duration-150',
  ].join(' '),

  cardMuted: [
    'bg-slate-50/80 dark:bg-gray-800/60',
    'rounded-2xl',
    'border-2 border-slate-200/80 dark:border-slate-600',
  ].join(' '),

  // buttonBase — shape + behavior only.
  // TIDAK ADA: px-N/py-N (padding), gap-N, text-N (font-size).
  // Disuplai oleh Button.tsx SIZE_CLASSES.
  buttonBase: [
    'inline-flex items-center justify-center',
    'rounded-xl',
    'font-medium',
    'transition-all duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
  ].join(' '),

  // buttonSecondary — shape + color only.
  // TIDAK ADA: px-N/py-N (padding), gap-N, text-N (font-size).
  buttonSecondary: [
    'inline-flex items-center justify-center',
    'rounded-xl',
    'border border-slate-200 dark:border-slate-600',
    'text-slate-800 dark:text-slate-200',
    'font-medium',
    'hover:bg-slate-50 dark:hover:bg-slate-700',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  // buttonDanger — shape + color only.
  // TIDAK ADA: px-N/py-N (padding), gap-N, text-N (font-size).
  buttonDanger: [
    'inline-flex items-center justify-center',
    'rounded-xl',
    'bg-red-600 hover:bg-red-700',
    'text-white',
    'font-medium',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
  ].join(' '),

  // input — shape/bg/transition/disabled only.
  // TIDAK ADA: px-N (padding-x), border-color, focus:ring/border-color.
  // Disuplai oleh Input/Textarea/Select via _inputColors + icon conditional.
  input: [
    'w-full py-2.5',
    'border',
    'rounded-xl',
    'bg-white dark:bg-gray-700',
    'text-sm text-gray-900 dark:text-white',
    'placeholder:text-slate-400 dark:placeholder:text-slate-500',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-2',
    'disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed',
  ].join(' '),

  /** Modal overlay + panel */
  overlay: [
    'fixed inset-0 z-50',
    'flex items-center justify-center p-4',
    'bg-black/30 dark:bg-black/50',
    'backdrop-blur-sm',
  ].join(' '),

  modalPanel: [
    'relative w-full',
    'bg-white dark:bg-gray-800',
    'rounded-2xl shadow-xl',
    'border-2 border-slate-200 dark:border-slate-600',
  ].join(' '),

  badgeBase: softBadgeBase,

  /** Badge */
  badge: [
    softBadgeBase,
    'gap-1',
    'px-2 py-0.5',
    'rounded-lg',
    'text-xs',
  ].join(' '),

  badgePill: [
    softBadgeBase,
    'gap-1',
    'px-2.5 py-1',
    'rounded-full',
    'text-xs',
  ].join(' '),

  /** Table row hover */
  tableRow: 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors duration-100',

  /** Divider */
  divider: 'border-slate-100 dark:border-slate-700',
} as const

// ─── Export ───────────────────────────────────────────────────────────────────

export const presets = { standard, soft } as const
export type PresetKey = keyof typeof presets
