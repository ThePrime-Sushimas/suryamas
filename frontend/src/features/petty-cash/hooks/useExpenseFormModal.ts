import { useState, useRef, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { PickedProduct } from '@/components/shared/ProductPickerModal'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import type { Category, SubCategory } from '@/features/categories/types'
import { useCategories as useAssetCategories } from '@/features/fixed-assets/api/fixed-assets.api'
import type { AssetCategory } from '@/features/fixed-assets/api/fixed-assets.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import type { Warehouse } from '@/features/inventory/types'
import { useProductUoms } from '@/features/product-uoms/api/productUoms.api'
import type { ProductUom } from '@/features/product-uoms/types'
import { useCreateExpense, useUploadPettyCashReceipt } from './pettyCash.api'

export type ExpenseMode = 'product' | 'operational' | 'asset'

export type ExpenseFormState = {
  category_id: string
  sub_category_id: string
  expense_date: string
  amount: number | ''
  description: string
  product_id: string
  warehouse_id: string
  qty: string
  unit_price: string
  asset_category_id: string
  asset_name: string
  asset_qty: string
  useful_life_months: string
  salvage_value: number | ''
  expense_coa_id: string
}

export type SelectedExpenseProduct = {
  id: string
  product_name: string
  affects_inventory: boolean
  uom: string
}

export type SelectedAssetExpenseProduct = {
  id: string
  product_name: string
  product_code: string
}

export interface UseExpenseFormModalReturn {
  expenseForm: ExpenseFormState
  setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>>
  expenseMode: ExpenseMode
  setExpenseMode: Dispatch<SetStateAction<ExpenseMode>>
  selectedProduct: SelectedExpenseProduct | null
  selectedAssetProduct: SelectedAssetExpenseProduct | null
  selectedUomId: string
  setSelectedUomId: Dispatch<SetStateAction<string>>
  trackInventory: boolean
  setTrackInventory: Dispatch<SetStateAction<boolean>>
  receiptFile: File | null
  setReceiptFile: Dispatch<SetStateAction<File | null>>
  fileInputRef: RefObject<HTMLInputElement | null>
  showProductPicker: boolean
  setShowProductPicker: Dispatch<SetStateAction<boolean>>
  showAssetProductPicker: boolean
  setShowAssetProductPicker: Dispatch<SetStateAction<boolean>>
  categories: Category[]
  subCategories: SubCategory[]
  warehouses: Warehouse[]
  assetCategories: AssetCategory[]
  uoms: ProductUom[]
  selectedAssetCategory: AssetCategory | undefined
  activeUom: ProductUom | undefined
  uomName: string
  conversionFactor: number
  baseUomName: string
  clearSelectedProduct: () => void
  clearSelectedAssetProduct: () => void
  handleProductPickerSelect: (product: PickedProduct) => void
  handleAssetProductPickerSelect: (product: PickedProduct) => void
  handleSubmit: () => Promise<void>
  isCreatePending: boolean
  isUploadPending: boolean
}

const EMPTY_FORM: ExpenseFormState = {
  category_id: '',
  sub_category_id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  amount: '',
  description: '',
  product_id: '',
  warehouse_id: '',
  qty: '',
  unit_price: '',
  asset_category_id: '',
  asset_name: '',
  asset_qty: '1',
  useful_life_months: '',
  salvage_value: '',
  expense_coa_id: '',
}

export function useExpenseFormModal(
  requestId: string,
  open: boolean,
  onClose: () => void,
): UseExpenseFormModalReturn {
  const toast = useToast()

  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(EMPTY_FORM)
  const [selectedProduct, setSelectedProduct] = useState<SelectedExpenseProduct | null>(null)
  const [selectedUomId, setSelectedUomId] = useState<string>('')
  const { data: uoms = [] } = useProductUoms(selectedProduct?.id ?? '', false)

  useEffect(() => {
    if (uoms.length > 0) {
      const defaultUom = uoms.find(u => u.is_default_purchase_unit) || uoms.find(u => u.is_base_unit) || uoms[0]
      if (defaultUom) {
        setSelectedUomId(defaultUom.id)
      }
    } else {
      setSelectedUomId('')
    }
  }, [uoms])

  const activeUom = uoms.find(u => u.id === selectedUomId)
  const uomName = activeUom?.metric_units?.unit_name ?? selectedProduct?.uom ?? 'pcs'
  const conversionFactor = activeUom?.conversion_factor ?? 1
  const baseUom = uoms.find(u => u.is_base_unit) || uoms.find(u => u.conversion_factor === 1)
  const baseUomName = baseUom?.metric_units?.unit_name ?? 'pcs'

  const [selectedAssetProduct, setSelectedAssetProduct] = useState<SelectedAssetExpenseProduct | null>(null)
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>('product')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showAssetProductPicker, setShowAssetProductPicker] = useState(false)
  const [trackInventory, setTrackInventory] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createExpenseMutation = useCreateExpense()
  const uploadReceiptMutation = useUploadPettyCashReceipt()
  const { data: categoriesData } = useCategories({ limit: 200 })
  const { data: subCategoriesData } = useSubCategories({ category_id: expenseForm.category_id, limit: 100 })
  const categories = categoriesData?.data ?? []
  const subCategories = subCategoriesData?.data ?? []
  const { data: warehousesData } = useWarehouses({ limit: 100 })
  const warehouses = warehousesData?.data ?? []
  const { data: assetCategoriesData } = useAssetCategories({ limit: 100, is_active: true, enabled: open })
  const assetCategories = assetCategoriesData?.data ?? []

  const selectedAssetCategory = assetCategories.find(c => c.id === expenseForm.asset_category_id)

  const resetForm = () => {
    setExpenseForm({
      ...EMPTY_FORM,
      expense_date: new Date().toISOString().slice(0, 10),
    })
    setSelectedProduct(null)
    setSelectedAssetProduct(null)
    setSelectedUomId('')
    setExpenseMode('product')
    setTrackInventory(false)
    setReceiptFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearSelectedProduct = () => {
    setSelectedProduct(null)
    setTrackInventory(false)
    setExpenseForm(f => ({ ...f, product_id: '', category_id: '', sub_category_id: '' }))
  }

  const clearSelectedAssetProduct = () => {
    setSelectedAssetProduct(null)
    setExpenseForm(f => ({
      ...f,
      asset_name: '',
      asset_category_id: '',
      expense_coa_id: '',
      asset_qty: '1',
      unit_price: '',
      amount: '',
    }))
  }

  const handleProductPickerSelect = (product: PickedProduct) => {
    setExpenseForm(f => ({
      ...f,
      product_id: product.id,
      category_id: product.category_id ?? '',
    }))
    setSelectedProduct({
      id: product.id,
      product_name: product.name,
      affects_inventory: product.affects_inventory ?? false,
      uom: product.uom_base ?? 'pcs',
    })
    setTrackInventory(product.affects_inventory ?? false)
    setShowProductPicker(false)
  }

  const handleAssetProductPickerSelect = (product: PickedProduct) => {
    const assetCat = product.asset_category_id
      ? assetCategories.find(c => c.id === product.asset_category_id)
      : undefined
    setExpenseForm(f => ({
      ...f,
      asset_name: product.name,
      category_id: product.category_id ?? f.category_id,
      asset_category_id: product.asset_category_id ?? f.asset_category_id,
      expense_coa_id: assetCat?.asset_coa_id ?? f.expense_coa_id,
      asset_qty: '1',
      unit_price: product.average_cost > 0 ? String(product.average_cost) : '',
      amount: product.average_cost > 0 ? product.average_cost : '',
    }))
    setSelectedAssetProduct({
      id: product.id,
      product_name: product.name,
      product_code: product.code,
    })
    setShowAssetProductPicker(false)
  }

  const handleSubmit = async () => {
    if (expenseForm.amount === '' || expenseForm.amount <= 0) {
      toast.error('Jumlah wajib > 0'); return
    }
    if (expenseMode === 'operational' && !expenseForm.category_id) {
      toast.error('Pilih kategori'); return
    }
    if (expenseMode === 'product' && !expenseForm.product_id) {
      toast.error('Pilih produk'); return
    }
    if (expenseMode === 'product' && !expenseForm.category_id) {
      toast.error('Produk tidak memiliki kategori. Pilih kategori di master produk terlebih dahulu.'); return
    }
    if (expenseMode === 'asset') {
      if (!expenseForm.category_id) { toast.error('Pilih kategori pengeluaran'); return }
      if (!selectedAssetProduct) { toast.error('Pilih produk aset'); return }
      if (!expenseForm.asset_category_id) { toast.error('Pilih kategori aset'); return }
      if (!expenseForm.asset_qty || Number(expenseForm.asset_qty) <= 0) {
        toast.error('Qty wajib > 0'); return
      }
    }
    if (trackInventory) {
      if (!expenseForm.warehouse_id) { toast.error('Gudang wajib diisi'); return }
      if (!expenseForm.qty || Number(expenseForm.qty) <= 0) { toast.error('Qty wajib > 0'); return }
    }
    try {
      const expense = await createExpenseMutation.mutateAsync({
        requestId,
        category_id: expenseForm.category_id,
        sub_category_id: expenseForm.sub_category_id || undefined,
        expense_date: expenseForm.expense_date || undefined,
        amount: expenseForm.amount,
        description: expenseForm.description || undefined,
        product_id: expenseMode === 'product'
          ? (expenseForm.product_id || undefined)
          : expenseMode === 'asset'
            ? (selectedAssetProduct?.id || undefined)
            : undefined,
        product_uom_id: expenseMode === 'product' ? (selectedUomId || undefined) : undefined,
        warehouse_id: (expenseMode === 'product' && trackInventory) ? (expenseForm.warehouse_id || undefined) : undefined,
        qty: expenseMode === 'product'
          ? (expenseForm.qty ? Number(expenseForm.qty) : undefined)
          : expenseMode === 'asset'
            ? Number(expenseForm.asset_qty)
            : undefined,
        unit_price: (expenseMode === 'product' || expenseMode === 'asset')
          ? (expenseForm.unit_price ? Number(expenseForm.unit_price) : undefined)
          : undefined,
        asset_category_id: expenseMode === 'asset' ? (expenseForm.asset_category_id || undefined) : undefined,
        asset_name: expenseMode === 'asset' ? (expenseForm.asset_name.trim() || undefined) : undefined,
        asset_qty: expenseMode === 'asset'
          ? (selectedAssetCategory?.tracking_method === 'POOLED' ? Number(expenseForm.asset_qty) : 1)
          : undefined,
        useful_life_months: expenseMode === 'asset' && expenseForm.useful_life_months ? Number(expenseForm.useful_life_months) : undefined,
        salvage_value: expenseMode === 'asset' && expenseForm.salvage_value !== ''
          ? expenseForm.salvage_value
          : undefined,
        expense_coa_id: expenseMode === 'asset' ? (expenseForm.expense_coa_id || undefined) : undefined,
      })

      let uploadFailed = false
      if (receiptFile && expense?.id) {
        try {
          await uploadReceiptMutation.mutateAsync({ expenseId: expense.id, file: receiptFile, requestId })
        } catch (uploadErr) {
          uploadFailed = true
          toast.warning(parseApiError(uploadErr, 'Expense berhasil disimpan, tetapi upload struk gagal. Coba upload ulang lewat edit expense.'))
        }
      }

      if (!uploadFailed) {
        toast.success('Expense ditambahkan')
      }
      resetForm()
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal menambah expense')) }
  }

  return {
    expenseForm,
    setExpenseForm,
    expenseMode,
    setExpenseMode,
    selectedProduct,
    selectedAssetProduct,
    selectedUomId,
    setSelectedUomId,
    trackInventory,
    setTrackInventory,
    receiptFile,
    setReceiptFile,
    fileInputRef,
    showProductPicker,
    setShowProductPicker,
    showAssetProductPicker,
    setShowAssetProductPicker,
    categories,
    subCategories,
    warehouses,
    assetCategories,
    uoms,
    selectedAssetCategory,
    activeUom,
    uomName,
    conversionFactor,
    baseUomName,
    clearSelectedProduct,
    clearSelectedAssetProduct,
    handleProductPickerSelect,
    handleAssetProductPickerSelect,
    handleSubmit,
    isCreatePending: createExpenseMutation.isPending,
    isUploadPending: uploadReceiptMutation.isPending,
  }
}
