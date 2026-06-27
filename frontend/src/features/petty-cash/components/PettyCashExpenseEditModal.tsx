import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Camera, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import api from '@/lib/axios'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useUpdateExpense, useUploadPettyCashReceipt } from '../api/pettyCash.api'
import type { PettyCashExpense } from '../types/pettyCash.types'
import { useProductUoms } from '@/features/product-uoms/api/productUoms.api'

interface PettyCashExpenseEditModalProps {
  open: boolean
  onClose: () => void
  expense: PettyCashExpense | null
  requestId: string
}

export function PettyCashExpenseEditModal({ open, onClose, expense, requestId }: PettyCashExpenseEditModalProps) {
  const toast = useToast()
  const updateMutation = useUpdateExpense()
  const uploadReceiptMutation = useUploadPettyCashReceipt()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
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

  // Populate form when expense changes
  useEffect(() => {
    if (expense) {
      setForm({
        category_id: expense.category_id ?? '',
        sub_category_id: expense.sub_category_id ?? '',
        expense_date: expense.expense_date ?? '',
        amount: String(expense.amount ?? ''),
        description: expense.description ?? '',
        qty: expense.qty != null ? String(expense.qty) : '',
        unit_price: expense.unit_price != null ? String(expense.unit_price) : '',
        warehouse_id: expense.warehouse_id ?? '',
      })
      setReceiptPreview(expense.receipt_url ?? null)
      setReceiptFile(null)
    }
  }, [expense])

  // Convert receipt_url (R2 path) → signed URL for <img> display
  useEffect(() => {
    if (!expense?.receipt_url) {
      setReceiptPreview(null)
      return
    }
    const raw = expense.receipt_url
    // Already a full URL
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
    setForm(f => ({ ...f, qty, amount: qtyNum && up ? String(qtyNum * up) : f.amount }))
  }

  const handleUnitPriceChange = (unit_price: string) => {
    const up = Number(unit_price) || 0
    const qtyNum = Number(form.qty) || 0
    setForm(f => ({ ...f, unit_price, amount: up && qtyNum ? String(up * qtyNum) : f.amount }))
  }

  const handleSubmit = async () => {
    if (!expense) return
    if (!form.amount || Number(form.amount) <= 0) {
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
        amount: Number(form.amount),
        description: form.description || null,
        qty: form.qty ? Number(form.qty) : null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        warehouse_id: form.warehouse_id || null,
        product_uom_id: selectedUomId || null,
      })

      // Upload receipt if new file selected
      if (receiptFile) {
        await uploadReceiptMutation.mutateAsync({
          expenseId: expense.id,
          file: receiptFile,
          requestId,
        })
      }

      toast.success('Expense diperbarui')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal memperbarui expense')) }
  }

  if (!open || !expense) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Pengeluaran</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          {/* Product info (read-only) */}
          {expense.product_name && (
            <div className="space-y-3">
              <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm">
                <span className="text-xs text-gray-500">Produk:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{expense.product_name}</span>
              </div>
              {uoms.length > 0 && (
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

          {/* Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kategori *</label>
              <select value={form.category_id} onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Pilih kategori</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
              </select>
            </div>
            {form.category_id && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sub-kategori</label>
                <select value={form.sub_category_id} onChange={(e) => setForm(f => ({ ...f, sub_category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">—</option>
                  {subCategories.length > 0 ? (
                    subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)
                  ) : (
                    <option value="" disabled>Memuat...</option>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Qty + Unit Price + Total */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Qty ({uomName})
                </label>
                <input type="number" value={form.qty} onChange={(e) => handleQtyChange(e.target.value)} placeholder="—" min="0" step="0.01" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Harga/{uomName}
                </label>
                <input type="number" value={form.unit_price} onChange={(e) => handleUnitPriceChange(e.target.value)} placeholder="—" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium" />
              </div>
            </div>
            {expense.affects_inventory && activeUom && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50 font-medium">
                Masuk gudang: <strong className="font-semibold">{(Number(form.qty) || 0) * conversionFactor} {baseUomName}</strong> (Satuan Base)
              </div>
            )}
          </div>

          {/* Date + Description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
              <input type="date" value={form.expense_date} onChange={(e) => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
              <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Opsional" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
          </div>

          {/* Warehouse (if inventory product) */}
          {expense.affects_inventory && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Gudang</label>
              <select value={form.warehouse_id} onChange={(e) => setForm(f => ({ ...f, warehouse_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Pilih gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
          )}

          {/* Receipt Photo */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Foto Struk</label>
            {(receiptPreview || receiptFile) && (
              <div className="mb-2 relative inline-block">
                <img
                  src={receiptFile ? URL.createObjectURL(receiptFile) : receiptPreview ?? ''}
                  alt="Receipt"
                  className="w-48 h-36 object-cover rounded-lg border border-gray-200"
                />
                {receiptFile && (
                  <button
                    onClick={() => setReceiptFile(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {receiptPreview && !receiptFile && (
              <p className="text-xs text-gray-400 mb-1">Foto sudah ada. Upload ulang untuk mengganti.</p>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setReceiptFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" /> {receiptPreview ? 'Ganti foto struk' : 'Upload foto struk (opsional)'}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleSubmit} disabled={updateMutation.isPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Menyimpan...</> : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
