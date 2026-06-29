import { forwardRef } from 'react'
import { Calendar } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { NORMAL_COLORS, ERROR_COLORS } from './_inputColors'

// TODO(design-system): native calendar picker icon belum di-style untuk dark
// mode (::-webkit-calendar-picker-indicator tidak bisa diakses via Tailwind).
// color-scheme CSS property bisa dipakai untuk fix ini di fase berikutnya.
// Di-skip sengaja untuk fase ini — icon Calendar dari lucide di kiri sudah
// cukup sebagai indikator visual, native icon browser tetap fungsional.

export interface DateInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Truthy = tampilkan border + focus ring merah (error state).
   * Untuk teks error, gunakan FormField.error — bukan prop ini.
   */
  error?: boolean | string
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      error,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const t = useTheme()

    const colorClasses = error ? ERROR_COLORS : NORMAL_COLORS

    // pl-9 konsisten dengan Input.tsx leftIcon padding (Calendar icon w-4 = 16px)
    // px-N tidak ada di preset — disuplai sepenuhnya dari sini
    const inputClasses = [t.input, colorClasses, 'pl-9 pr-3', className]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="relative">
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />

        <input
          ref={ref}
          type="date"
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
      </div>
    )
  },
)

DateInput.displayName = 'DateInput'
