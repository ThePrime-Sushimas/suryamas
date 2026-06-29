import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { NORMAL_COLORS, ERROR_COLORS } from './_inputColors'

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Truthy = tampilkan border + focus ring merah (error state).
   * Untuk teks error, gunakan FormField.error — bukan prop ini.
   */
  error?: boolean | string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      error,
      className = '',
      children,
      ...rest
    },
    ref,
  ) => {
    const t = useTheme()

    const colorClasses = error ? ERROR_COLORS : NORMAL_COLORS

    // pl-3 pr-9: pr-9 mengakomodasi ChevronDown icon (w-4 + gap) di kanan
    // appearance-none: hapus browser-native arrow supaya tidak dobel dengan icon custom
    const selectClasses = [
      t.input,
      colorClasses,
      'pl-3 pr-9',
      'appearance-none cursor-pointer',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="relative">
        <select
          ref={ref}
          className={selectClasses}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {children}
        </select>

        {/* pointer-events-none supaya tidak block click/tap ke <select> */}
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
      </div>
    )
  },
)

Select.displayName = 'Select'
