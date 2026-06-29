// _inputColors.ts — shared internal color constants untuk Input, Textarea, Select.
// Prefix _ menandai file ini internal — tidak di-export dari index.ts.
//
// NORMAL_COLORS: border slate + focus ring indigo.
//   Hardcode indigo karena accents.* belum expose focus:border-* sebagai public token.
//   Konsisten dengan warna yang dipakai di preset sebelum dikeluarkan.
//
// ERROR_COLORS: derived dari semanticColors.danger (red family).
//   border-red-300: satu shade lebih visible dari danger.border (border-red-200)
//     yang dipakai di badge/bg context — form input border butuh contrast lebih.
//   focus:ring-red-500: companion standar, 2 shade lebih gelap dari border-red-300.
//   dark: border-red-600 + ring-red-500 — cukup visible di dark surface.
//   Semua tetap dalam red family yang sama dengan semanticColors.danger.

export const NORMAL_COLORS =
  'border-slate-200 dark:border-slate-600 ' +
  'focus:ring-indigo-500 focus:border-indigo-500 ' +
  'dark:focus:ring-indigo-400 dark:focus:border-indigo-400'

export const ERROR_COLORS =
  'border-red-300 dark:border-red-600 ' +
  'focus:ring-red-500 focus:border-red-500 ' +
  'dark:focus:ring-red-500 dark:focus:border-red-500'
