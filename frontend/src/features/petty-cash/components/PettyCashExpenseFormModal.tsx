import { Dialog, Button, FormField, DateInput, Textarea } from '@/components/ui'
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
  const isPending = form.isCreatePending || form.isUploadPending

  const handleClose = () => {
    if (isPending) return
    onClose()
  }

  const submitLabel = form.isCreatePending
    ? 'Menyimpan...'
    : form.isUploadPending
      ? 'Upload struk...'
      : 'Simpan'

  return (
    <>
      <Dialog
        isOpen={open}
        onClose={handleClose}
        size="lg"
        preventClose={isPending}
      >
        <Dialog.Header>Tambah Pengeluaran</Dialog.Header>

        <Dialog.Body className="space-y-4">
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
            <FormField label="Tanggal">
              {({ inputId, describedBy }) => (
                <DateInput
                  id={inputId}
                  aria-describedby={describedBy}
                  value={form.expenseForm.expense_date}
                  onChange={(e) =>
                    form.setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))
                  }
                />
              )}
            </FormField>
            <FormField label="Keterangan">
              {({ inputId, describedBy }) => (
                <Textarea
                  id={inputId}
                  aria-describedby={describedBy}
                  value={form.expenseForm.description}
                  onChange={(e) =>
                    form.setExpenseForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Opsional"
                  rows={2}
                />
              )}
            </FormField>
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
        </Dialog.Body>

        <Dialog.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            Batal
          </Button>
          <Button variant="primary" loading={isPending} onClick={form.handleSubmit}>
            {submitLabel}
          </Button>
        </Dialog.Footer>
      </Dialog>

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
