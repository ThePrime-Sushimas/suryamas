/**
 * components/ui/index.ts
 *
 * Barrel file untuk design system primitives.
 * Hanya export komponen baru (ThemeProvider + Button + form primitives).
 *
 * Komponen lama (ConfirmModal, Pagination, Skeleton, ThemeToggle,
 * ToastContainer) tetap diimport langsung dari file masing-masing
 * seperti sebelumnya — tidak ada perubahan pada cara pakainya.
 *
 * _inputColors.ts adalah internal module — tidak di-export dari sini.
 */

// ─── Theme Context ────────────────────────────────────────────────────────────
export { ThemeProvider, useTheme, useThemeConfig }        from './ThemeProvider'

// ─── Primitives ───────────────────────────────────────────────────────────────
export { Button }                                         from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize }    from './Button'

export { FormField }                                      from './FormField'
export type { FormFieldProps, FormFieldHelpers }          from './FormField'

export { Input }                                          from './Input'
export type { InputProps }                                from './Input'

export { Textarea }                                       from './Textarea'
export type { TextareaProps }                             from './Textarea'

export { Select }                                         from './Select'
export type { SelectProps }                               from './Select'

export { CurrencyInput }                                  from './CurrencyInput'
export type { CurrencyInputProps }                        from './CurrencyInput'

export { DateInput }                                      from './DateInput'
export type { DateInputProps }                            from './DateInput'

export { Dialog }                                         from './Dialog'
export type {
  DialogProps,
  DialogSize,
  DialogHeaderProps,
  DialogBodyProps,
  DialogFooterProps,
}                                                         from './Dialog'

export { StatusBadge }                                    from './StatusBadge'
export type {
  StatusBadgeProps,
  StatusBadgeVariant,
  StatusBadgeSize,
}                                                         from './StatusBadge'

export { SegmentedControl }                               from './SegmentedControl'
export type {
  SegmentedControlProps,
  SegmentedControlOption,
}                                                         from './SegmentedControl'

export { FileUpload }                                     from './FileUpload'
export type { FileUploadProps, FileUploadDisplay }        from './FileUpload'
