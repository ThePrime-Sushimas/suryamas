import { Button } from '@/components/ui'
import type { ExpenseMode } from '../../hooks/useExpenseFormModal'

export interface ExpenseModeToggleProps {
  mode: ExpenseMode
  onModeChange: (mode: ExpenseMode) => void
}

const MODES: Array<{ value: ExpenseMode; label: string }> = [
  { value: 'product', label: 'Beli Barang' },
  { value: 'operational', label: 'Biaya Operasional' },
  { value: 'asset', label: 'Pembelian Aset' },
]

const ACTIVE_TOGGLE_CLASS =
  'bg-blue-100 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'

export function ExpenseModeToggle({ mode, onModeChange }: ExpenseModeToggleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODES.map(({ value, label }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onModeChange(value)}
          className={
            mode === value
              ? ACTIVE_TOGGLE_CLASS
              : 'text-gray-500 dark:text-gray-400'
          }
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
