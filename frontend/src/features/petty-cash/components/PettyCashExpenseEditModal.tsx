import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import { useWarehouses } from '@/features/inventory/api/inventory.api'
import { useUpdateExpense } from '../api/pettyCash.api'
import type { PettyCashExpense } from '../types/pettyCash.types'

interface PettyCashExpenseEditModalProps {
  open: boolean
  onClose: () => void
  expense: PettyCashExpense | null
  requestId: string
}

export function PettyCashExpenseEditModal({ open, onClose, expense, requestId }: PettyCashExpenseEditModalProps) {
  const toast = useToast()
  const updateMutation = useUpdateExpense()

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
    }
  }, [expense])

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
      })
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
            <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm">
              <span className="text-xs text-gray-500">Produk:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{expense.product_name}</span>
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
            {form.category_id && subCategories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sub-kategori</label>
                <select value={form.sub_category_id} onChange={(e) => setForm(f => ({ ...f, sub_category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">—</option>
                  {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Qty + Unit Price + Total */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Qty{expense.base_unit_name ? ` (${expense.base_unit_name})` : ''}
              </label>
              <input type="number" value={form.qty} onChange={(e) => handleQtyChange(e.target.value)} placeholder="—" min="0" step="0.01" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Harga/{expense.base_unit_name || 'unit'}
              </label>
              <input type="number" value={form.unit_price} onChange={(e) => handleUnitPriceChange(e.target.value)} placeholder="—" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium" />
            </div>
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
