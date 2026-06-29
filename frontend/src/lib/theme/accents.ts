/**
 * accents.ts — Layer 3: Accent Palettes
 *
 * Setiap accent mendefinisikan shade mapping (Tailwind class strings),
 * cukup untuk disuplai ke preset dan getTheme().
 *
 * Cara menambah accent baru (misal: emerald, amber):
 *   1. Buat const baru dengan struktur yang sama seperti accentIndigo
 *   2. Tambahkan ke export `accents`
 *   3. Tambahkan ke type AccentKey
 *   4. (Opsional) Daftarkan custom hex di tailwind.config.js kalau
 *      Tailwind built-in tidak cukup presisi
 *
 * rose sudah built-in di Tailwind — tidak perlu custom hex.
 * indigo sudah built-in di Tailwind — tidak perlu custom hex.
 */

// ─── Indigo Accent (DEFAULT) ─────────────────────────────────────────────────
// Basis: #5B5FBF → indigo Tailwind scale sudah cukup dekat.
// indigo-600 (#4f46e5) ≈ #5B5FBF, indigo-700 (#4338ca) sedikit lebih gelap.
// Dipakai untuk semua modul yang belum punya accent spesifik.

const accentIndigo = {
  /** Shade map — per shade: bg/text/border class strings */
  50:  { bg: 'bg-indigo-50',  text: 'text-indigo-50',  border: 'border-indigo-50'  },
  100: { bg: 'bg-indigo-100', text: 'text-indigo-100', border: 'border-indigo-100' },
  200: { bg: 'bg-indigo-200', text: 'text-indigo-200', border: 'border-indigo-200' },
  300: { bg: 'bg-indigo-300', text: 'text-indigo-300', border: 'border-indigo-300' },
  500: { bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500' },
  600: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-600' },
  700: { bg: 'bg-indigo-700', text: 'text-indigo-700', border: 'border-indigo-700' },

  /** Dark mode variants */
  dark: {
    50:  { bg: 'dark:bg-indigo-900/15', text: 'dark:text-indigo-300', border: 'dark:border-indigo-800/60' },
    200: { bg: 'dark:bg-indigo-900/20', text: 'dark:text-indigo-400', border: 'dark:border-indigo-700'    },
    600: { bg: 'dark:bg-indigo-700',    text: 'dark:text-white',       border: 'dark:border-indigo-600'   },
  },

  /** Composed classes untuk komponen umum */
  button: {
    /** Solid primary button — gunakan dengan presets.*.buttonBase */
    solid: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500',
    /** Ghost/outline button */
    ghost: 'border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
  },

  /** Surface tint — warm-tinted backgrounds untuk preset.soft */
  surface: {
    page:    'bg-indigo-50/30 dark:bg-gray-900',
    card:    'bg-white dark:bg-gray-800',
    muted:   'bg-indigo-50/50 dark:bg-gray-800/60',
    border:  'border-indigo-200/70 dark:border-slate-600',
    border2: 'border-2 border-indigo-200/70 dark:border-slate-600',
  },

  /** Focus ring — dipakai di input */
  focusRing: 'focus:ring-indigo-500 dark:focus:ring-indigo-400',
} as const

// ─── Sky Accent ──────────────────────────────────────────────────────────────
// Basis: Tailwind sky scale — built-in, tidak perlu custom hex.
// sky-600 (#0284c7) fresh blue untuk primary actions.
// Aman dari konflik status color (green=success, red=danger, yellow=warning).

const accentSky = {
  /** Shade map */
  50:  { bg: 'bg-sky-50',  text: 'text-sky-50',  border: 'border-sky-50'  },
  100: { bg: 'bg-sky-100', text: 'text-sky-100', border: 'border-sky-100' },
  200: { bg: 'bg-sky-200', text: 'text-sky-200', border: 'border-sky-200' },
  300: { bg: 'bg-sky-300', text: 'text-sky-300', border: 'border-sky-300' },
  500: { bg: 'bg-sky-500', text: 'text-sky-500', border: 'border-sky-500' },
  600: { bg: 'bg-sky-600', text: 'text-sky-600', border: 'border-sky-600' },
  700: { bg: 'bg-sky-700', text: 'text-sky-700', border: 'border-sky-700' },

  /** Dark mode variants */
  dark: {
    50:  { bg: 'dark:bg-sky-900/15', text: 'dark:text-sky-300', border: 'dark:border-sky-800/60' },
    200: { bg: 'dark:bg-sky-900/20', text: 'dark:text-sky-400', border: 'dark:border-sky-700'    },
    600: { bg: 'dark:bg-sky-700',    text: 'dark:text-white',    border: 'dark:border-sky-600'   },
  },

  /** Composed classes untuk komponen umum */
  button: {
    /** Solid primary button */
    solid: 'bg-sky-600 hover:bg-sky-700 text-white focus:ring-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500',
    /** Ghost/outline button */
    ghost: 'border border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20',
  },

  /** Surface tint */
  surface: {
    page:    'bg-sky-50/30 dark:bg-gray-900',
    card:    'bg-white dark:bg-gray-800',
    muted:   'bg-sky-50/50 dark:bg-gray-800/60',
    border:  'border-sky-200/70 dark:border-slate-600',
    border2: 'border-2 border-sky-200/70 dark:border-slate-600',
  },

  /** Focus ring */
  focusRing: 'focus:ring-sky-500 dark:focus:ring-sky-400',
} as const

// ─── Rose Accent ─────────────────────────────────────────────────────────────
// Basis: diekstrak dari ap-payments.theme.ts (rose/pink palette).
// rose sudah built-in di Tailwind — tidak perlu custom hex.
// Untuk migrasi AP Payments di fase berikutnya.
//
// Catatan dark mode: konsisten dalam family rose di light DAN dark.
// Fallback-ke-indigo yang ada di ap-payments.theme.ts adalah keputusan
// spesifik AP Payments — akan ditangani sebagai override saat migrasi
// AP Payments (fase terpisah), bukan dibakar ke definisi accent generic ini.

const accentRose = {
  /** Shade map */
  50:  { bg: 'bg-rose-50',  text: 'text-rose-50',  border: 'border-rose-50'  },
  100: { bg: 'bg-rose-100', text: 'text-rose-100', border: 'border-rose-100' },
  200: { bg: 'bg-rose-200', text: 'text-rose-200', border: 'border-rose-200' },
  300: { bg: 'bg-rose-300', text: 'text-rose-300', border: 'border-rose-300' },
  500: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  600: { bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-600' },
  700: { bg: 'bg-rose-700', text: 'text-rose-700', border: 'border-rose-700' },

  /** Dark mode variants — konsisten rose */
  dark: {
    50:  { bg: 'dark:bg-rose-900/15', text: 'dark:text-rose-300', border: 'dark:border-rose-800/60' },
    200: { bg: 'dark:bg-rose-900/20', text: 'dark:text-rose-400', border: 'dark:border-rose-700'    },
    600: { bg: 'dark:bg-rose-600',    text: 'dark:text-white',     border: 'dark:border-rose-500'   },
  },

  button: {
    /** Solid — NO gradient, sesuai aturan preset.soft cleanup */
    solid: 'bg-rose-500 hover:bg-rose-600 text-white focus:ring-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500',
    ghost: 'border border-rose-200 dark:border-slate-600 text-rose-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-slate-700',
  },

  /** Surface tint — warm cream pola dari ap-payments.theme.ts, dibersihkan */
  surface: {
    page:    'bg-rose-50/40 dark:bg-gray-900',
    card:    'bg-rose-50/60 dark:bg-gray-800',
    muted:   'bg-rose-100/40 dark:bg-gray-800/60',
    border:  'border-rose-200/80 dark:border-slate-600',
    border2: 'border-2 border-rose-200/80 dark:border-slate-600',
  },

  focusRing: 'focus:ring-rose-500 dark:focus:ring-rose-400',
} as const

// ─── Export ───────────────────────────────────────────────────────────────────

export const accents = { indigo: accentIndigo, sky: accentSky, rose: accentRose } as const
export type AccentKey = keyof typeof accents
