export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

const SIZE_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
} as const

const ITEM_PADDING = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
} as const

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
  className = '',
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/80 ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={[
              ITEM_PADDING[size],
              SIZE_CLASSES[size],
              'rounded-lg font-medium transition-colors',
              isActive
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              option.disabled ? 'cursor-not-allowed opacity-50' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
