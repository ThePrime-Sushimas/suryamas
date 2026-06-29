import { forwardRef, type ReactNode } from 'react'
import { useTheme } from './ThemeProvider'
import { NORMAL_COLORS, ERROR_COLORS } from './_inputColors'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Truthy = tampilkan border + focus ring merah (error state).
   * Untuk teks error, gunakan FormField.error — bukan prop ini.
   */
  error?:      boolean | string
  leftIcon?:   ReactNode
  rightIcon?:  ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      error,
      leftIcon,
      rightIcon,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const t = useTheme()

    // ── Satu set border-color + focus-ring per kondisi — tidak ada dua sumber ─
    const colorClasses = error ? ERROR_COLORS : NORMAL_COLORS

    // ── padding-x: dikondisikan oleh icon — px-N tidak ada di preset ──────────
    const paddingX = leftIcon ? 'pl-9 pr-3' : rightIcon ? 'pl-3 pr-9' : 'px-3'

    const inputClasses = [t.input, colorClasses, paddingX, className]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="relative">
        {leftIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          {...rest}
        />

        {rightIcon && (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
