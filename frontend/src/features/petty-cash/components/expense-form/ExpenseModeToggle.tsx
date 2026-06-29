import { SegmentedControl } from '@/components/ui'
import type { ExpenseMode } from '../../hooks/useExpenseFormModal'

export interface ExpenseModeToggleProps {
  mode: ExpenseMode
  onModeChange: (mode: ExpenseMode) => void
}

const MODES = [
  { value: 'product' as const, label: 'Beli Barang' },
  { value: 'operational' as const, label: 'Biaya Operasional' },
  { value: 'asset' as const, label: 'Pembelian Aset' },
]

export function ExpenseModeToggle({ mode, onModeChange }: ExpenseModeToggleProps) {
  return (
    <SegmentedControl
      value={mode}
      onChange={onModeChange}
      options={MODES}
      aria-label="Jenis pengeluaran"
    />
  )
}
