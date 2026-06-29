# Design Token System — Panduan Penggunaan

> Versi: 1.0 — Foundation Layer (tokens only, belum ada komponen React)

## Import

```typescript
import { getTheme, semanticColors, presets, accents } from '@/lib/theme'
```

`lib/tailwind-theme.ts` lama **tetap ada** dan tidak diubah — backward compat sampai migrasi per-feature selesai.

---

## 3 Layer

| Layer | File | Export utama |
|---|---|---|
| 1 — Semantic | `tokens.ts` | `semanticColors`, `spacingTokens`, `typographyTokens` |
| 2 — Presets | `presets.ts` | `presets.standard`, `presets.soft` |
| 3 — Accents | `accents.ts` | `accents.indigo` (default), `accents.rose` |
| Helper | `index.ts` | `getTheme(preset, accent)` |
| Referensi | `statusMappings.ts` | `statusMappings.*` |

---

## Cara Pakai: `getTheme()`

```typescript
import { getTheme } from '@/lib/theme'

const t = getTheme()                    // standard + indigo (default)
const t = getTheme('standard', 'indigo') // sama seperti di atas, eksplisit
const t = getTheme('soft', 'rose')      // untuk modul bergaya soft/warm
```

### Di JSX

```tsx
const t = getTheme('standard', 'indigo')

// Card
<div className={t.card}>...</div>
<div className={t.cardMuted}>...</div>

// Button primary = base shape + accent color
<button className={`${t.button.base} ${t.accentButton.solid}`}>
  Simpan
</button>

// Button secondary (netral, tidak butuh accent)
<button className={t.button.secondary}>Batal</button>

// Button danger (semantik merah)
<button className={t.button.danger}>Hapus</button>

// Input
<input className={t.input} />

// Modal
<div className={t.modal.overlay}>
  <div className={`${t.modal.panel} max-w-md w-full`}>
    ...
  </div>
</div>

// Status badge — gabung badge shape + semantic color
<span className={[
  t.badge,
  t.semantic.success.bg,
  t.semantic.success.bgDark,
  t.semantic.success.text,
  t.semantic.success.textDark,
  t.semantic.success.border,
  t.semantic.success.borderDark,
].join(' ')}>
  Aktif
</span>

// Table row hover
<tr className={t.tableRow}>...</tr>
```

---

## Semantic Colors Langsung (tanpa getTheme)

Gunakan ini kalau hanya butuh warna status, tanpa preset shape:

```typescript
import { semanticColors } from '@/lib/theme'

const c = semanticColors.success
// c.bg, c.bgDark, c.border, c.borderDark, c.text, c.textDark, c.icon, c.iconDark
```

Semua semantic keys: `success` | `warning` | `danger` | `info` | `neutral`

**Catatan:** `danger` memakai family `red` (bukan `rose`) — sengaja, supaya tidak
tabrakan visual dengan `accent.rose` yang dipakai sebagai brand color modul.

---

## Status Mappings (pola untuk migrasi badge)

```typescript
import { statusMappings, semanticColors } from '@/lib/theme'

// Mapping domain status string → semantic key
const semanticKey = statusMappings.pettyCash['CLOSED']   // → 'success'
const semanticKey = statusMappings.fixedAsset['ACTIVE']  // → 'success'
const semanticKey = statusMappings.journal['DRAFT']      // → 'neutral'

// Lalu ambil warna
const color = semanticColors[semanticKey]
// color.bg, color.text, dst.
```

Mappings tersedia: `reconciliation` | `pettyCash` | `fixedAsset` | `journal` | `apPayment`

---

## Preset: `standard` vs `soft`

| | `standard` | `soft` |
|---|---|---|
| Card radius | `rounded-lg` (8px) | `rounded-2xl` (16px) |
| Button radius | `rounded-md` (6px) | `rounded-xl` (12px) |
| Card border | `border` (1px) | `border-2` (2px) |
| Button style | solid, no gradient | solid, no gradient |
| Shadow | `shadow-sm` netral | `shadow-sm` netral |
| Overlay opacity | `bg-black/40` | `bg-black/30` (lebih lembut) |
| Karakter | Clean, enterprise | Warm, rounded |

Kedua preset: **tidak ada gradient, tidak ada colored shadow**.

---

## Menambah Accent Baru

```typescript
// Di accents.ts, tambahkan const baru dengan struktur ini:
const accentEmerald = {
  50:  { bg: 'bg-emerald-50',  text: 'text-emerald-50',  border: 'border-emerald-50'  },
  100: { bg: 'bg-emerald-100', text: 'text-emerald-100', border: 'border-emerald-100' },
  200: { bg: 'bg-emerald-200', text: 'text-emerald-200', border: 'border-emerald-200' },
  300: { bg: 'bg-emerald-300', text: 'text-emerald-300', border: 'border-emerald-300' },
  500: { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
  600: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600' },
  700: { bg: 'bg-emerald-700', text: 'text-emerald-700', border: 'border-emerald-700' },
  dark: {
    50:  { bg: 'dark:bg-emerald-900/15', text: 'dark:text-emerald-300', border: 'dark:border-emerald-800/60' },
    200: { bg: 'dark:bg-emerald-900/20', text: 'dark:text-emerald-400', border: 'dark:border-emerald-700'    },
    600: { bg: 'dark:bg-emerald-700',    text: 'dark:text-white',        border: 'dark:border-emerald-600'   },
  },
  button: {
    solid: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500',
    ghost: 'border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
  surface: {
    page:    'bg-emerald-50/30 dark:bg-gray-900',
    card:    'bg-white dark:bg-gray-800',
    muted:   'bg-emerald-50/50 dark:bg-gray-800/60',
    border:  'border-emerald-200/70 dark:border-slate-600',
    border2: 'border-2 border-emerald-200/70 dark:border-slate-600',
  },
  focusRing: 'focus:ring-emerald-500 dark:focus:ring-emerald-400',
} as const

// Lalu tambahkan ke export:
export const accents = { indigo: accentIndigo, rose: accentRose, emerald: accentEmerald }
// TypeScript otomatis update AccentKey → 'indigo' | 'rose' | 'emerald'
```

---

## Yang BELUM Ada (fase berikutnya)

- `<StatusBadge>` React component generik (pakai `semanticColors` + `statusMappings`)
- `<Dialog>` / `<Modal>` primitive (pakai `presets.*.overlay` + `presets.*.modalPanel`)
- `<Button>` React component (pakai `presets.*.buttonBase` + `accent.button.solid`)
- Migrasi modul-modul yang sudah ada (satu per satu, dimulai dari duplikasi tertinggi)
- Migrasi AP Payments ke `accent.rose` + `preset.soft` (dengan override dark mode khusus)
