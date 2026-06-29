import { useState, useCallback, useId } from 'react'
import { useTheme } from './ThemeProvider'
import { NORMAL_COLORS, ERROR_COLORS } from './_inputColors'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrencyInputProps {
  /** Nilai numerik, atau '' saat field kosong/belum diisi */
  value:       number | ''
  onChange:    (value: number | '') => void
  /**
   * Izinkan desimal — default false (integer/bulat).
   * Aktifkan untuk kurs/rate yang butuh presisi desimal.
   */
  allowDecimal?:  boolean
  error?:         boolean | string
  disabled?:      boolean
  /** Placeholder yang ditampilkan saat kosong. Default: '0' */
  placeholder?:   string
  id?:            string
  name?:          string
  'aria-describedby'?: string
  className?:     string
}
// Catatan forwardRef: CurrencyInput tidak meng-expose ref ke HTMLInputElement
// karena ref.current.value akan menampilkan displayValue (string formatted),
// bukan numeric value. Ini misleading. Focus management bisa dilakukan via
// id prop: document.getElementById(id)?.focus().
// Kalau dibutuhkan (misal RHF setFocus), tambahkan forwardRef +
// useImperativeHandle yang expose { focus, blur } saja — tidak breaking change.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Konversi number ke string display untuk mode fokus (raw, tanpa pemisah ribuan).
 * Saat allowDecimal=false: truncate dengan Math.trunc (bukan round).
 * Kalau value punya desimal tapi allowDecimal=false, itu indikasi data dari luar
 * tidak konsisten — log warning sekali supaya developer bisa debug.
 */
function numberToDisplay(value: number | '', allowDecimal: boolean): string {
  if (value === '') return ''
  if (!allowDecimal) {
    if (!Number.isInteger(value)) {
      console.warn(
        `[CurrencyInput] value ${value} punya desimal tapi allowDecimal=false. ` +
        'Desimal di-truncate. Periksa apakah data dari luar sudah integer.',
      )
    }
    return String(Math.trunc(value as number))
  }
  // Konversi titik desimal JS → koma ID supaya konsisten saat user lanjut mengetik
  return String(value).replace('.', ',')
}

/**
 * Format number ke string display saat blur — pemisah ribuan + desimal format ID.
 */
function formatIDR(num: number, allowDecimal: boolean): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: allowDecimal ? 2 : 0,
  }).format(num)
}

/**
 * Parse string format ID yang diketik user ke number.
 * Asumsi: titik = ribuan, koma = desimal (format Indonesia).
 * Keamanan koma ganda dijamin oleh handleChange yang tidak mengizinkan >1 koma masuk.
 */
function parseDisplay(display: string, allowDecimal: boolean): number | '' {
  if (display === '' || display === ',') return ''
  if (!allowDecimal) {
    const n = parseInt(display.replace(/\D/g, ''), 10)
    return isNaN(n) ? '' : n
  }
  // Strip titik ribuan, ganti koma desimal → titik JS, lalu parse
  const normalized = display.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return isNaN(n) ? '' : n
}

/**
 * Parse string dari clipboard — handle dua kemungkinan format:
 *   Format ID: titik = ribuan, koma = desimal  (contoh: "150.000,50")
 *   Format US: titik = desimal                 (contoh: "150000.50")
 *
 * Heuristik deteksi (dieksekusi berurutan):
 *  1. Ada koma DAN titik → format ID. Strip titik, ganti koma → titik.
 *  2. Ada hanya koma    → koma = desimal ID. Ganti koma → titik.
 *  3. Ada hanya titik:
 *     a. Tepat 1 titik diikuti 1-2 digit di ujung → desimal US. Parse as-is.
 *     b. Titik diikuti 3 digit, atau >1 titik     → ribuan ID. Strip titik.
 *  4. Tidak ada keduanya → integer biasa.
 *
 * TRADE-OFF YANG DISADARI: heuristik ini tidak 100% akurat untuk semua input.
 * Contoh ambiguitas: "2.500" bisa berarti 2500 (ribuan ID) atau 2.5 (kurs US).
 * Karena semua field currency IDR diasumsikan > Rp 100, "2.500" hampir pasti
 * ribuan ID. Kasus kurs desimal kecil (misal "1.25") dihandle oleh case 3a
 * (1 titik, 2 digit). Trade-off ini diterima secara sadar — untuk edge case
 * yang ambiguous, user bisa ketik manual daripada paste.
 */
function parsePastedNumber(raw: string, allowDecimal: boolean): number | '' {
  const str = raw.trim().replace(/[^\d.,]/g, '')
  if (str === '') return ''

  const hasDot   = str.includes('.')
  const hasComma = str.includes(',')
  let normalized: string

  if (hasDot && hasComma) {
    // Case 1: ada keduanya → format ID
    normalized = str.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // Case 2: hanya koma → desimal ID
    normalized = str.replace(',', '.')
  } else if (hasDot && !hasComma) {
    const afterLastDot = str.split('.').pop() ?? ''
    const dotCount     = (str.match(/\./g) ?? []).length
    if (dotCount === 1 && afterLastDot.length <= 2) {
      // Case 3a: desimal US — parse as-is (sudah format float JS)
      normalized = str
    } else {
      // Case 3b: ribuan ID — strip titik
      normalized = str.replace(/\./g, '')
    }
  } else {
    // Case 4: integer murni
    normalized = str
  }

  if (!allowDecimal) {
    normalized = normalized.split('.')[0]
  }

  const n = allowDecimal ? parseFloat(normalized) : parseInt(normalized, 10)
  return isNaN(n) ? '' : n
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CurrencyInput({
  value,
  onChange,
  allowDecimal = false,
  error,
  disabled,
  placeholder = '0',
  id,
  name,
  'aria-describedby': ariaDescribedBy,
  className = '',
}: CurrencyInputProps) {
  const t         = useTheme()
  const generated = useId()
  const inputId   = id ?? generated

  const [isFocused,    setIsFocused]    = useState(false)
  const [displayValue, setDisplayValue] = useState<string>(() =>
    value === '' ? '' : formatIDR(value, allowDecimal),
  )

  // Saat tidak fokus, sync display dari value prop (reset form / setValue dari luar)
  const visibleValue = isFocused
    ? displayValue
    : (value === '' ? '' : formatIDR(value, allowDecimal))

  const colorClasses = error ? ERROR_COLORS : NORMAL_COLORS
  // pl-10: prefix teks "Rp" (~28px) butuh lebih lebar dari pl-9 (icon 16px)
  // px-N tidak ada di preset — disuplai sepenuhnya dari sini
  const inputClasses = [t.input, colorClasses, 'pl-10 pr-3', className]
    .filter(Boolean)
    .join(' ')

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setDisplayValue(numberToDisplay(value, allowDecimal))
  }, [value, allowDecimal])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    let allowed: string

    if (!allowDecimal) {
      allowed = raw.replace(/\D/g, '')
    } else {
      // Strip non-digit non-koma, lalu enforce maksimal satu koma
      const digits      = raw.replace(/[^\d,]/g, '')
      const firstComma  = digits.indexOf(',')
      if (firstComma === -1) {
        allowed = digits
      } else {
        // Bagian setelah koma pertama tidak boleh mengandung koma lagi
        allowed =
          digits.slice(0, firstComma + 1) +
          digits.slice(firstComma + 1).replace(/,/g, '')
      }
    }

    setDisplayValue(allowed)
    onChange(parseDisplay(allowed, allowDecimal))
  }, [allowDecimal, onChange])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    const num = parseDisplay(displayValue, allowDecimal)
    if (num === '') {
      setDisplayValue('')
      onChange('')
    } else {
      setDisplayValue(formatIDR(num, allowDecimal))
      onChange(num)
    }
  }, [displayValue, allowDecimal, onChange])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    const num    = parsePastedNumber(pasted, allowDecimal)

    if (num !== '') {
      // Parse berhasil — intercept paste, set value yang sudah dinormalisasi
      e.preventDefault()
      setDisplayValue(numberToDisplay(num, allowDecimal))
      onChange(num)
    }
    // Parse gagal + pasted tidak kosong:
    // JANGAN preventDefault — biarkan browser paste teks asli.
    // Value tidak valid akan terdeteksi oleh error state form saat submit.
    // Lebih baik user lihat teks ter-paste daripada paste yang "hilang".
  }, [allowDecimal, onChange])

  return (
    <div className="relative">
      {/* Prefix "Rp" — visual only, tidak masuk ke value */}
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500 select-none"
        aria-hidden="true"
      >
        Rp
      </span>

      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        value={visibleValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={ariaDescribedBy}
        className={inputClasses}
      />
    </div>
  )
}
