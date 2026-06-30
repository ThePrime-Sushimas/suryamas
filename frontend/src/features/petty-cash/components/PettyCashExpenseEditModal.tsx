import { Dialog, Button, FormField, DateInput, Textarea } from '@/components/ui'
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

export function PettyCashExpenseEditModal({
  open,
  onClose,
  expense,
  requestId,
}: PettyCashExpenseEditModalProps) {
  const form = useExpenseEditForm(expense, requestId, onClose)

  const handleClose = () => {
    if (form.isUpdatePending) return
    onClose()
  }

  if (!expense) return null

  return (
    <Dialog
      isOpen={open}
      onClose={handleClose}
      size="lg"
      preventClose={form.isUpdatePending}
    >
      <Dialog.Header>Edit Pengeluaran</Dialog.Header>

      <Dialog.Body className="space-y-4">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Tanggal">
            {({ inputId, describedBy }) => (
              <DateInput
                id={inputId}
                aria-describedby={describedBy}
                value={form.form.expense_date}
                onChange={(e) =>
                  form.setForm((f) => ({ ...f, expense_date: e.target.value }))
                }
              />
            )}
          </FormField>
          <FormField label="Keterangan">
            {({ inputId, describedBy }) => (
              <Textarea
                id={inputId}
                aria-describedby={describedBy}
                value={form.form.description}
                onChange={(e) =>
                  form.setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                placeholder="Opsional"
              />
            )}
          </FormField>
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
      </Dialog.Body>

      <Dialog.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={form.isUpdatePending}>
          Batal
        </Button>
        <Button
          variant="primary"
          loading={form.isUpdatePending}
          onClick={form.handleSubmit}
        >
          {form.isUpdatePending ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
