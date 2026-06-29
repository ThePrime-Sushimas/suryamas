import { useId, type ReactNode } from 'react'
import { semanticColors } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormFieldHelpers {
  /**
   * id yang di-assign ke input — sama dengan htmlFor kalau diberikan,
   * atau auto-generated via useId() kalau tidak.
   */
  inputId: string
  /**
   * Nilai untuk aria-describedby pada input — berisi errorId kalau error ada,
   * undefined kalau tidak. Sengaja undefined (bukan string kosong) supaya
   * React tidak me-render attribute aria-describedby kalau nilainya undefined.
   */
  describedBy: string | undefined
}

type FormFieldChildren =
  | ReactNode
  | ((helpers: FormFieldHelpers) => ReactNode)

export interface FormFieldProps {
  label?:      string
  required?:   boolean
  /**
   * Pesan error — ditampilkan di bawah input dengan warna danger.
   * Menggantikan helperText kalau keduanya ada.
   */
  error?:      string
  /**
   * Teks helper — ditampilkan di bawah input kalau TIDAK ada error.
   */
  helperText?: string
  /**
   * Dipakai sebagai htmlFor pada <label> dan inputId pada helpers.
   * Kalau tidak diberikan, FormField auto-generate id via useId().
   */
  htmlFor?:    string
  /**
   * Slot untuk Input/Select/Textarea.
   *
   * Bisa berupa ReactNode biasa (tanpa aria-describedby):
   *   <FormField label="Keterangan">
   *     <Textarea placeholder="Opsional..." />
   *   </FormField>
   *
   * Atau render-props function (dengan aria-describedby untuk aksesibilitas):
   *   <FormField label="Email" required error={errors.email?.message}>
   *     {({ inputId, describedBy }) => (
   *       <Input
   *         id={inputId}
   *         aria-describedby={describedBy}
   *         error={!!errors.email}
   *         {...register('email')}
   *       />
   *     )}
   *   </FormField>
   *
   * FormField TIDAK meng-inject styling ke children secara implisit.
   * Error styling pada input harus di-set eksplisit via prop `error`
   * pada komponen Input/Textarea/Select itu sendiri.
   */
  children: FormFieldChildren
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isRenderProps(
  children: FormFieldChildren,
): children is (helpers: FormFieldHelpers) => ReactNode {
  return typeof children === 'function'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FormField({
  label,
  required,
  error,
  helperText,
  htmlFor,
  children,
}: FormFieldProps) {
  // useId() — SSR-safe, tidak collision antar instance, React 18+ built-in.
  const generatedId = useId()
  const inputId     = htmlFor ?? generatedId
  const errorId     = error ? `${inputId}-error` : undefined
  const describedBy = errorId

  const helpers: FormFieldHelpers = { inputId, describedBy }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && (
            <span
              className="ml-0.5 text-red-500 dark:text-red-400"
              aria-hidden="true"
            >
              {' *'}
            </span>
          )}
        </label>
      )}

      {isRenderProps(children) ? children(helpers) : children}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className={`text-xs ${semanticColors.danger.text} ${semanticColors.danger.textDark}`}
        >
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
