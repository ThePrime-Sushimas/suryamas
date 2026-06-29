import { forwardRef } from 'react'
import { useTheme } from './ThemeProvider'
import { NORMAL_COLORS, ERROR_COLORS } from './_inputColors'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Truthy = tampilkan border + focus ring merah (error state).
   * Untuk teks error, gunakan FormField.error — bukan prop ini.
   */
  error?: boolean | string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      error,
      rows = 3,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const t = useTheme()

    const colorClasses = error ? ERROR_COLORS : NORMAL_COLORS

    // px-3 tidak ada di preset — disuplai dari sini (tidak ada icon conditional)
    const textareaClasses = [t.input, colorClasses, 'px-3', 'resize-y', className]
      .filter(Boolean)
      .join(' ')

    return (
      <textarea
        ref={ref}
        rows={rows}
        className={textareaClasses}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
