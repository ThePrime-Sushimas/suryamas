import { useState, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import type { Category, SubCategory } from '@/features/categories/types'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import type { Warehouse } from '@/features/inventory/types'
import { useProductUoms } from '@/features/product-uoms/api/productUoms.api'
import type { ProductUom } from '@/features/product-uoms/types'
import { useUpdateExpense, useUploadPettyCashReceipt } from './pettyCash.api'
import type { PettyCashExpense } from '../types/pettyCash.types'

export type ExpenseEditFormState = {
  category_id: string
  sub_category_id: string
  expense_date: string
  amount: number | ''
  description: string
  qty: string
  unit_price: string
  warehouse_id: string
}

export interface UseExpenseEditFormReturn {
  form: ExpenseEditFormState
  setForm: Dispatch<SetStateAction<ExpenseEditFormState>>
  receiptFile: File | null
  setReceiptFile: Dispatch<SetStateAction<File | null>>
  receiptPreview: string | null
  selectedUomId: string
  setSelectedUomId: Dispatch<SetStateAction<string>>
  fileInputRef: RefObject<HTMLInputElement | null>
  categories: Category[]
  subCategories: SubCategory[]
  warehouses: Warehouse[]
  uoms: ProductUom[]
  activeUom: ProductUom | undefined
  uomName: string
  conversionFactor: number
  baseUomName: string
  handleQtyChange: (qty: string) => void
  handleUnitPriceChange: (unit_price: string) => void
  handleSubmit: () => Promise<void>
  isUpdatePending: boolean
}

export function useExpenseEditForm(
  expense: PettyCashExpense | null,
  requestId: string,
  onClose: () => void,
): UseExpenseEditFormReturn {
  const toast = useToast()
  const updateMutation = useUpdateExpense()
  const uploadReceiptMutation = useUploadPettyCashReceipt()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<ExpenseEditFormState>({
    category_id: '',
    sub_category_id: '',
    expense_date: '',
    amount: '',
    description: '',
    qty: '',
    unit_price: '',
    warehouse_id: '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const [selectedUomId, setSelectedUomId] = useState<string>('')
  const { data: uoms = [] } = useProductUoms(expense?.product_id ?? '', false)

  useEffect(() => {
    if (expense?.product_uom_id) {
      setSelectedUomId(expense.product_uom_id)
    } else if (uoms.length > 0) {
      const defaultUom = uoms.find(u => u.is_default_purchase_unit) || uoms.find(u => u.is_base_unit) || uoms[0]
      if (defaultUom) setSelectedUomId(defaultUom.id)
    } else {
      setSelectedUomId('')
    }
  }, [expense, uoms])

  const activeUom = uoms.find(u => u.id === selectedUomId)
  const uomName = activeUom?.metric_units?.unit_name ?? expense?.product_uom_name ?? expense?.base_unit_name ?? 'unit'
  const conversionFactor = activeUom?.conversion_factor ?? 1
  const baseUom = uoms.find(u => u.is_base_unit) || uoms.find(u => u.conversion_factor === 1)
  const baseUomName = baseUom?.metric_units?.unit_name ?? expense?.base_unit_name ?? 'pcs'

  const { data: categoriesData } = useCategories({ limit: 200 })
  const { data: subCategoriesData } = useSubCategories({ category_id: form.category_id, limit: 100 })
  const categories = categoriesData?.data ?? []
  const subCategories = subCategoriesData?.data ?? []
  const { data: warehousesData } = useWarehouses({ limit: 100 })
  const warehouses = warehousesData?.data ?? []

  useEffect(() => {
    if (expense) {
      setForm({
        category_id: expense.category_id ?? '',
        sub_category_id: expense.sub_category_id ?? '',
        expense_date: expense.expense_date ?? '',
        amount: expense.amount ?? '',
        description: expense.description ?? '',
        qty: expense.qty != null ? String(expense.qty) : '',
        unit_price: expense.unit_price != null ? String(expense.unit_price) : '',
        warehouse_id: expense.warehouse_id ?? '',
      })
      setReceiptPreview(expense.receipt_url ?? null)
      setReceiptFile(null)
    }
  }, [expense])

  useEffect(() => {
    if (!expense?.receipt_url) {
      setReceiptPreview(null)
      return
    }
    const raw = expense.receipt_url
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      setReceiptPreview(raw)
      return
    }
    let cancelled = false
    api.get('/storage/signed-url', { params: { path: raw, bucket: 'buktisetoran' } })
      .then((res) => { if (!cancelled) setReceiptPreview(res.data?.data?.url ?? null) })
      .catch(() => { if (!cancelled) setReceiptPreview(null) })
    return () => { cancelled = true }
  }, [expense?.receipt_url])

  const handleQtyChange = (qty: string) => {
    const qtyNum = Number(qty) || 0
    const up = Number(form.unit_price) || 0
    setForm(f => ({ ...f, qty, amount: qtyNum && up ? qtyNum * up : f.amount }))
  }

  const handleUnitPriceChange = (unit_price: string) => {
    const up = Number(unit_price) || 0
    const qtyNum = Number(form.qty) || 0
    setForm(f => ({ ...f, unit_price, amount: up && qtyNum ? up * qtyNum : f.amount }))
  }

  const handleSubmit = async () => {
    if (!expense) return
    if (form.amount === '' || form.amount <= 0) {
      toast.error('Jumlah wajib > 0'); return
    }
    if (!form.category_id) {
      toast.error('Kategori wajib diisi'); return
    }
    try {
      await updateMutation.mutateAsync({
        id: expense.id,
        requestId,
        category_id: form.category_id,
        sub_category_id: form.sub_category_id || null,
        expense_date: form.expense_date || undefined,
        amount: form.amount,
        description: form.description || null,
        qty: form.qty ? Number(form.qty) : null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        warehouse_id: form.warehouse_id || null,
        product_uom_id: selectedUomId || null,
      })

      let uploadFailed = false
      if (receiptFile) {
        try {
          await uploadReceiptMutation.mutateAsync({
            expenseId: expense.id,
            file: receiptFile,
            requestId,
          })
        } catch (uploadErr) {
          uploadFailed = true
          toast.warning(parseApiError(uploadErr, 'Expense berhasil diperbarui, tetapi upload struk gagal. Coba upload ulang.'))
        }
      }

      if (!uploadFailed) {
        toast.success('Expense diperbarui')
      }
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal memperbarui expense')) }
  }

  return {
    form,
    setForm,
    receiptFile,
    setReceiptFile,
    receiptPreview,
    selectedUomId,
    setSelectedUomId,
    fileInputRef,
    categories,
    subCategories,
    warehouses,
    uoms,
    activeUom,
    uomName,
    conversionFactor,
    baseUomName,
    handleQtyChange,
    handleUnitPriceChange,
    handleSubmit,
    isUpdatePending: updateMutation.isPending,
  }
}
