import type { ExpenseMode } from '../../hooks/useExpenseFormModal'

export interface ExpenseModeToggleProps {
  mode: ExpenseMode
  onModeChange: (mode: ExpenseMode) => void
}

export function ExpenseModeToggle({ mode, onModeChange }: ExpenseModeToggleProps) {
  return (
    <div className="flex gap-2 text-xs">
      <button type="button" onClick={() => onModeChange('product')} className={`px-3 py-1.5 rounded-lg font-medium ${mode === 'product' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
        Beli Barang
      </button>
      <button type="button" onClick={() => onModeChange('operational')} className={`px-3 py-1.5 rounded-lg font-medium ${mode === 'operational' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
        Biaya Operasional
      </button>
      <button type="button" onClick={() => onModeChange('asset')} className={`px-3 py-1.5 rounded-lg font-medium ${mode === 'asset' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
        Pembelian Aset
      </button>
    </div>
  )
}
