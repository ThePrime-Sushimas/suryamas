import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useCreateExpense } from '../api/pettyCash.api'
import { ProductPickerModal } from '@/components/shared/ProductPickerModal'

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
  })
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; product_name: string; affects_inventory: boolean; uom: string } | null>(null)
  const [expenseMode, setExpenseMode] = useState<'product' | 'operational'>('product')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [trackInventory, setTrackInventory] = useState(false)

  const createExpenseMutation = useCreateExpense()
  const { data: categoriesData } = useCategories({ limit: 200 })
  const { data: subCategoriesData } = useSubCategories({ category_id: expenseForm.category_id, limit: 100 })
  const categories = categoriesData?.data ?? []
  const subCategories = subCategoriesData?.data ?? []
  const { data: warehousesData } = useWarehouses({ limit: 100 })
  const warehouses = warehousesData?.data ?? []

  const resetForm = () => {
    setExpenseForm({ category_id: '', sub_category_id: '', expense_date: new Date().toISOString().slice(0, 10), amount: '', description: '', product_id: '', warehouse_id: '', qty: '', unit_price: '' })
    setSelectedProduct(null)
    setExpenseMode('product')
    setTrackInventory(false)
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
    if (trackInventory) {
      if (!expenseForm.warehouse_id) { toast.error('Gudang wajib diisi'); return }
      if (!expenseForm.qty || Number(expenseForm.qty) <= 0) { toast.error('Qty wajib > 0'); return }
    }
    try {
      await createExpenseMutation.mutateAsync({
        requestId,
        category_id: expenseForm.category_id,
        sub_category_id: expenseForm.sub_category_id || undefined,
        expense_date: expenseForm.expense_date || undefined,
        amount: Number(expenseForm.amount),
        description: expenseForm.description || undefined,
        product_id: trackInventory ? (expenseForm.product_id || undefined) : undefined,
        warehouse_id: trackInventory ? (expenseForm.warehouse_id || undefined) : undefined,
        qty: trackInventory && expenseForm.qty ? Number(expenseForm.qty) : undefined,
        unit_price: expenseForm.unit_price ? Number(expenseForm.unit_price) : undefined,
      })
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
            </div>

            {/* Product-first mode */}
            {expenseMode === 'product' && (
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
            )}

            {/* Operational mode */}
            {expenseMode === 'operational' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kategori *</label>
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

            {/* Amount section */}
            {expenseMode === 'product' && selectedProduct ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Qty ({selectedProduct.uom})</label>
                  <input type="number" value={expenseForm.qty} onChange={(e) => {
                    const qty = e.target.value
                    const up = Number(expenseForm.unit_price) || 0
                    setExpenseForm(f => ({ ...f, qty, amount: qty && up ? String(Number(qty) * up) : f.amount }))
                  }} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harga/{selectedProduct.uom}</label>
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
            <button onClick={handleSubmit} disabled={createExpenseMutation.isPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {createExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Picker (nested modal) */}
      <ProductPickerModal
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
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
    </>
  )
}
