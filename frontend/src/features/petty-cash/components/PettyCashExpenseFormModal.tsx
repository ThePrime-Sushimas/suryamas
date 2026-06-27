import { useState, useRef, useEffect } from 'react'
import { X, Loader2, Camera } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import { useCategories as useAssetCategories } from '@/features/fixed-assets/api/fixed-assets.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useCreateExpense, useUploadPettyCashReceipt } from '../api/pettyCash.api'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'
import { useProductUoms } from '@/features/product-uoms/api/productUoms.api'

interface PettyCashExpenseFormModalProps {
  open: boolean
  onClose: () => void
  requestId: string
}

export function PettyCashExpenseFormModal({ open, onClose, requestId }: PettyCashExpenseFormModalProps) {
  const toast = useToast()

  const [expenseForm, setExpenseForm] = useState({
    category_id: '', sub_category_id: '', expense_date: new Date().toISOString().slice(0, 10),
    amount: '', description: '', product_id: '', warehouse_id: '', qty: '', unit_price: '',
    // Asset fields
    asset_category_id: '', asset_name: '', asset_qty: '1', useful_life_months: '', salvage_value: '',
    expense_coa_id: '',
  })
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; product_name: string; affects_inventory: boolean; uom: string } | null>(null)
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

  const [selectedAssetProduct, setSelectedAssetProduct] = useState<{ id: string; product_name: string; product_code: string } | null>(null)
  const [expenseMode, setExpenseMode] = useState<'product' | 'operational' | 'asset'>('product')
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
      category_id: '', sub_category_id: '', expense_date: new Date().toISOString().slice(0, 10),
      amount: '', description: '', product_id: '', warehouse_id: '', qty: '', unit_price: '',
      asset_category_id: '', asset_name: '', asset_qty: '1', useful_life_months: '', salvage_value: '',
      expense_coa_id: '',
    })
    setSelectedProduct(null)
    setSelectedAssetProduct(null)
    setSelectedUomId('')
    setExpenseMode('product')
    setTrackInventory(false)
    setReceiptFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
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
        amount: Number(expenseForm.amount),
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
        // Asset mode
        asset_category_id: expenseMode === 'asset' ? (expenseForm.asset_category_id || undefined) : undefined,
        asset_name: expenseMode === 'asset' ? (expenseForm.asset_name.trim() || undefined) : undefined,
        asset_qty: expenseMode === 'asset'
          ? (selectedAssetCategory?.tracking_method === 'POOLED' ? Number(expenseForm.asset_qty) : 1)
          : undefined,
        useful_life_months: expenseMode === 'asset' && expenseForm.useful_life_months ? Number(expenseForm.useful_life_months) : undefined,
        salvage_value: expenseMode === 'asset' && expenseForm.salvage_value ? Number(expenseForm.salvage_value) : undefined,
        expense_coa_id: expenseMode === 'asset' ? (expenseForm.expense_coa_id || undefined) : undefined,
      })

      // Auto-upload receipt if file selected
      if (receiptFile && expense?.id) {
        try {
          await uploadReceiptMutation.mutateAsync({ expenseId: expense.id, file: receiptFile, requestId })
        } catch {
          toast.warning('Expense berhasil dibuat, tapi upload struk gagal. Coba upload ulang nanti.')
        }
      }

      toast.success('Expense ditambahkan')
      resetForm()
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal menambah expense')) }
  }

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
            {/* Mode toggle */}
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setExpenseMode('product')} className={`px-3 py-1.5 rounded-lg font-medium ${expenseMode === 'product' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                Beli Barang
              </button>
              <button type="button" onClick={() => setExpenseMode('operational')} className={`px-3 py-1.5 rounded-lg font-medium ${expenseMode === 'operational' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                Biaya Operasional
              </button>
              <button type="button" onClick={() => setExpenseMode('asset')} className={`px-3 py-1.5 rounded-lg font-medium ${expenseMode === 'asset' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                Pembelian Aset
              </button>
            </div>


            {/* Product-first mode */}
            {expenseMode === 'product' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Produk *</label>
                  {selectedProduct ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                      <div>
                        <span className="text-gray-900 dark:text-white font-medium">{selectedProduct.product_name}</span>
                        {expenseForm.category_id && <span className="ml-2 text-xs text-gray-500">({categories.find(c => c.id === expenseForm.category_id)?.category_name})</span>}
                      </div>
                      <button type="button" onClick={() => { setSelectedProduct(null); setTrackInventory(false); setExpenseForm(f => ({ ...f, product_id: '', category_id: '', sub_category_id: '' })) }}>
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowProductPicker(true)} className="w-full px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                      Klik untuk cari produk...
                    </button>
                  )}
                </div>
                {selectedProduct && uoms.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Satuan Pembelian *</label>
                    <select value={selectedUomId} onChange={(e) => setSelectedUomId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                      {uoms.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.metric_units?.unit_name} {u.is_default_purchase_unit ? '(Default Beli)' : ''} {u.is_base_unit ? '(Satuan Base)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Operational mode */}
            {expenseMode === 'operational' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kategori Pengeluaran *</label>
                  <select value={expenseForm.category_id} onChange={(e) => setExpenseForm(f => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                    <option value="">Pilih kategori</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
                  </select>
                </div>
                {expenseForm.category_id && subCategories.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sub-kategori</label>
                    <select value={expenseForm.sub_category_id} onChange={(e) => setExpenseForm(f => ({ ...f, sub_category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                      <option value="">—</option>
                      {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Asset mode */}
            {expenseMode === 'asset' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Produk Aset *</label>
                  {selectedAssetProduct ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                      <div>
                        <span className="text-gray-900 dark:text-white font-medium">{selectedAssetProduct.product_name}</span>
                        <span className="ml-2 text-xs text-gray-500 font-mono">{selectedAssetProduct.product_code}</span>
                      </div>
                      <button type="button" onClick={() => {
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
                      }}>
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowAssetProductPicker(true)} className="w-full px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                      Klik untuk cari produk aset...
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kategori Pengeluaran *</label>
                  <select value={expenseForm.category_id} onChange={(e) => setExpenseForm(f => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                    <option value="">Pilih kategori pengeluaran</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kategori Aset (Fixed Asset) *</label>
                  <select value={expenseForm.asset_category_id} onChange={(e) => {
                    const catId = e.target.value
                    const cat = assetCategories.find(c => c.id === catId)
                    setExpenseForm(f => ({
                      ...f,
                      asset_category_id: catId,
                      expense_coa_id: cat?.asset_coa_id ?? '',
                      asset_qty: cat?.tracking_method === 'POOLED' ? f.asset_qty : '1',
                    }))
                  }} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                    <option value="">Pilih kategori aset</option>
                    {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.category_code} — {ac.category_name} ({ac.tracking_method})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">COA Aset (otomatis)</label>
                  <div className="px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400">
                    {selectedAssetCategory?.asset_coa_code && selectedAssetCategory?.asset_coa_name
                      ? `${selectedAssetCategory.asset_coa_code} — ${selectedAssetCategory.asset_coa_name}`
                      : '—'}
                  </div>
                </div>              
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Masa Manfaat (Bulan)</label>
                    <input type="number" value={expenseForm.useful_life_months} onChange={(e) => setExpenseForm(f => ({ ...f, useful_life_months: e.target.value }))} placeholder={selectedAssetCategory ? String(selectedAssetCategory.default_useful_life_months) : 'Default kat.'} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nilai Residu (IDR)</label>
                    <input type="number" value={expenseForm.salvage_value} onChange={(e) => setExpenseForm(f => ({ ...f, salvage_value: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                  </div>
                </div>
              </div>
            )}


            {/* Amount section */}
            {expenseMode === 'product' && selectedProduct ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Qty ({uomName})</label>
                    <input type="number" value={expenseForm.qty} onChange={(e) => {
                      const qty = e.target.value
                      const up = Number(expenseForm.unit_price) || 0
                      setExpenseForm(f => ({ ...f, qty, amount: qty && up ? String(Number(qty) * up) : f.amount }))
                    }} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Harga/{uomName}</label>
                    <input type="number" value={expenseForm.unit_price} onChange={(e) => {
                      const up = e.target.value
                      const qty = Number(expenseForm.qty) || 0
                      setExpenseForm(f => ({ ...f, unit_price: up, amount: up && qty ? String(Number(up) * qty) : f.amount }))
                    }} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
                    <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium" />
                  </div>
                </div>
                {trackInventory && activeUom && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    Masuk gudang: <strong className="font-semibold">{(Number(expenseForm.qty) || 0) * conversionFactor} {baseUomName}</strong> (Satuan Base)
                  </div>
                )}
              </div>
            ) : expenseMode === 'asset' && selectedAssetProduct ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Qty {selectedAssetCategory?.tracking_method === 'POOLED' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    value={expenseForm.asset_qty}
                    disabled={selectedAssetCategory?.tracking_method !== 'POOLED'}
                    onChange={(e) => {
                      const qty = e.target.value
                      const up = Number(expenseForm.unit_price) || 0
                      setExpenseForm(f => ({
                        ...f,
                        asset_qty: qty,
                        amount: qty && up ? String(Number(qty) * up) : f.amount,
                      }))
                    }}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-900/50"
                  />
                  {selectedAssetCategory?.tracking_method !== 'POOLED' && (
                    <p className="text-[10px] text-gray-400 mt-0.5">INDIVIDUAL: qty tetap 1</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harga Satuan</label>
                  <input
                    type="number"
                    value={expenseForm.unit_price}
                    onChange={(e) => {
                      const up = e.target.value
                      const qty = Number(expenseForm.asset_qty) || 0
                      setExpenseForm(f => ({
                        ...f,
                        unit_price: up,
                        amount: up && qty ? String(Number(up) * qty) : f.amount,
                      }))
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah *</label>
                <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
            )}

            {/* Date + Description */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
                <input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
                <textarea value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="Opsional" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
            </div>

            {/* Receipt upload */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Foto Struk</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {receiptFile ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 text-sm">
                  <span className="text-green-700 dark:text-green-300 truncate">
                    <Camera className="w-3.5 h-3.5 inline mr-1.5" />{receiptFile.name}
                  </span>
                  <button type="button" onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Upload foto struk (opsional)
                </button>
              )}
            </div>

            {/* Inventory checkbox + warehouse */}
            {expenseMode === 'product' && selectedProduct && (
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Masukkan ke gudang (inventory)</span>
                </label>
                {trackInventory && (
                  <div className="border-l-2 border-blue-300 pl-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gudang *</label>
                    <select value={expenseForm.warehouse_id} onChange={(e) => setExpenseForm(f => ({ ...f, warehouse_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                      <option value="">Pilih gudang</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
            <button onClick={handleSubmit} disabled={createExpenseMutation.isPending || uploadReceiptMutation.isPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {createExpenseMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Menyimpan...</>
                : uploadReceiptMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Upload struk...</>
                : 'Simpan'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Picker — inventory mode */}
      <ProductPickerModal
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        hideUom
        onSelect={(product) => {
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
        }}
        title="Pilih Produk untuk Expense"
      />

      {/* Product Picker — asset mode (is_asset only) */}
      <ProductPickerModal
        open={showAssetProductPicker}
        onClose={() => setShowAssetProductPicker(false)}
        hideUom
        filterAsset
        onSelect={(product) => {
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
            amount: product.average_cost > 0 ? String(product.average_cost) : '',
          }))
          setSelectedAssetProduct({
            id: product.id,
            product_name: product.name,
            product_code: product.code,
          })
          setShowAssetProductPicker(false)
        }}
        title="Pilih Produk Aset"
      />
    </>
  )
}
