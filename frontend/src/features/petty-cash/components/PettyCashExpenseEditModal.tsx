import { X, Loader2 } from 'lucide-react'
import type { PettyCashExpense } from '../types/pettyCash.types'
import { useExpenseEditForm } from '../hooks/useExpenseEditForm'
import { ExpenseEditProductSection } from './expense-form/ExpenseEditProductSection'
import { ExpenseEditCategoryFields } from './expense-form/ExpenseEditCategoryFields'
import { ExpenseEditAmountFields } from './expense-form/ExpenseEditAmountFields'
import { ExpenseEditWarehouseField } from './expense-form/ExpenseEditWarehouseField'
import { ExpenseReceiptEditor } from './expense-form/ExpenseReceiptEditor'

interface PettyCashExpenseEditModalProps {
  open: boolean
  onClose: () => void
  expense: PettyCashExpense | null
  requestId: string
}

export function PettyCashExpenseEditModal({ open, onClose, expense, requestId }: PettyCashExpenseEditModalProps) {
  const form = useExpenseEditForm(expense, requestId, onClose)

  if (!open || !expense) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Pengeluaran</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          {expense.product_name && (
            <ExpenseEditProductSection
              productName={expense.product_name}
              uoms={form.uoms}
              selectedUomId={form.selectedUomId}
              onSelectedUomIdChange={form.setSelectedUomId}
            />
          )}

          <ExpenseEditCategoryFields
            form={form.form}
            setForm={form.setForm}
            categories={form.categories}
            subCategories={form.subCategories}
          />

          <ExpenseEditAmountFields
            form={form.form}
            setForm={form.setForm}
            uomName={form.uomName}
            showInventoryHint={expense.affects_inventory}
            activeUom={form.activeUom}
            conversionFactor={form.conversionFactor}
            baseUomName={form.baseUomName}
            onQtyChange={form.handleQtyChange}
            onUnitPriceChange={form.handleUnitPriceChange}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
              <input type="date" value={form.form.expense_date} onChange={(e) => form.setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
              <textarea value={form.form.description} onChange={(e) => form.setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Opsional" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
          </div>

          {expense.affects_inventory && (
            <ExpenseEditWarehouseField
              form={form.form}
              setForm={form.setForm}
              warehouses={form.warehouses}
            />
          )}

          <ExpenseReceiptEditor
            receiptPreview={form.receiptPreview}
            receiptFile={form.receiptFile}
            fileInputRef={form.fileInputRef}
            onFileChange={form.setReceiptFile}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={form.handleSubmit} disabled={form.isUpdatePending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {form.isUpdatePending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Menyimpan...</> : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
