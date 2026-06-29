import { X, Loader2 } from 'lucide-react'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'
import { useExpenseFormModal } from '../hooks/useExpenseFormModal'
import { ExpenseModeToggle } from './expense-form/ExpenseModeToggle'
import { ProductExpenseFields } from './expense-form/ProductExpenseFields'
import { OperationalExpenseFields } from './expense-form/OperationalExpenseFields'
import { AssetExpenseFields } from './expense-form/AssetExpenseFields'
import { ExpenseAmountFields } from './expense-form/ExpenseAmountFields'
import { ExpenseReceiptUpload } from './expense-form/ExpenseReceiptUpload'
import { ExpenseInventorySection } from './expense-form/ExpenseInventorySection'

interface PettyCashExpenseFormModalProps {
  open: boolean
  onClose: () => void
  requestId: string
}

export function PettyCashExpenseFormModal({ open, onClose, requestId }: PettyCashExpenseFormModalProps) {
  const form = useExpenseFormModal(requestId, open, onClose)

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Pengeluaran</h3>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <ExpenseModeToggle mode={form.expenseMode} onModeChange={form.setExpenseMode} />

            {form.expenseMode === 'product' && (
              <ProductExpenseFields
                expenseForm={form.expenseForm}
                categories={form.categories}
                selectedProduct={form.selectedProduct}
                uoms={form.uoms}
                selectedUomId={form.selectedUomId}
                onOpenProductPicker={() => form.setShowProductPicker(true)}
                onClearSelectedProduct={form.clearSelectedProduct}
                onSelectedUomIdChange={form.setSelectedUomId}
              />
            )}

            {form.expenseMode === 'operational' && (
              <OperationalExpenseFields
                expenseForm={form.expenseForm}
                setExpenseForm={form.setExpenseForm}
                categories={form.categories}
                subCategories={form.subCategories}
              />
            )}

            {form.expenseMode === 'asset' && (
              <AssetExpenseFields
                expenseForm={form.expenseForm}
                setExpenseForm={form.setExpenseForm}
                categories={form.categories}
                assetCategories={form.assetCategories}
                selectedAssetProduct={form.selectedAssetProduct}
                selectedAssetCategory={form.selectedAssetCategory}
                onOpenAssetProductPicker={() => form.setShowAssetProductPicker(true)}
                onClearSelectedAssetProduct={form.clearSelectedAssetProduct}
              />
            )}

            <ExpenseAmountFields
              expenseMode={form.expenseMode}
              expenseForm={form.expenseForm}
              setExpenseForm={form.setExpenseForm}
              selectedProduct={form.selectedProduct}
              selectedAssetProduct={form.selectedAssetProduct}
              selectedAssetCategory={form.selectedAssetCategory}
              uomName={form.uomName}
              trackInventory={form.trackInventory}
              activeUom={form.activeUom}
              conversionFactor={form.conversionFactor}
              baseUomName={form.baseUomName}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={form.expenseForm.expense_date} onChange={(e) => form.setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
                <textarea value={form.expenseForm.description} onChange={(e) => form.setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="Opsional" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
            </div>

            <ExpenseReceiptUpload
              receiptFile={form.receiptFile}
              fileInputRef={form.fileInputRef}
              onFileChange={form.setReceiptFile}
            />

            {form.expenseMode === 'product' && form.selectedProduct && (
              <ExpenseInventorySection
                expenseForm={form.expenseForm}
                setExpenseForm={form.setExpenseForm}
                trackInventory={form.trackInventory}
                onTrackInventoryChange={form.setTrackInventory}
                warehouses={form.warehouses}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
            <button onClick={form.handleSubmit} disabled={form.isCreatePending || form.isUploadPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {form.isCreatePending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Menyimpan...</>
                : form.isUploadPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Upload struk...</>
                : 'Simpan'}
            </button>
          </div>
        </div>
      </div>

      <ProductPickerModal
        open={form.showProductPicker}
        onClose={() => form.setShowProductPicker(false)}
        hideUom
        onSelect={form.handleProductPickerSelect}
        title="Pilih Produk untuk Expense"
      />

      <ProductPickerModal
        open={form.showAssetProductPicker}
        onClose={() => form.setShowAssetProductPicker(false)}
        hideUom
        filterAsset
        onSelect={form.handleAssetProductPickerSelect}
        title="Pilih Produk Aset"
      />
    </>
  )
}
