import { useState } from 'react'
import { FolderKanban, Plus, Pencil, Trash2, Check } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useMenuCategories, useCreateMenuCategory, useUpdateMenuCategory, useDeleteMenuCategory, useCoaOptions } from '../api/food-production.api'
import type { MenuCategory } from '../types/food-production.types'

export default function MenuCategoriesPage() {
  const toast = useToast()
  const categories = useMenuCategories()
  const coaOptions = useCoaOptions()
  const createCategory = useCreateMenuCategory()
  const updateCategory = useUpdateMenuCategory()
  const deleteCategory = useDeleteMenuCategory()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formSalesCoaId, setFormSalesCoaId] = useState('')
  const [formCogsCoaId, setFormCogsCoaId] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const resetForm = () => {
    setShowForm(false); setEditingId(null)
    setFormCode(''); setFormName(''); setFormSalesCoaId(''); setFormCogsCoaId(''); setFormSortOrder(0)
  }

  const startEdit = (c: MenuCategory) => {
    setEditingId(c.id)
    setFormCode(c.category_code)
    setFormName(c.category_name)
    setFormSalesCoaId(c.sales_coa_id || '')
    setFormCogsCoaId(c.cogs_coa_id || '')
    setFormSortOrder(c.sort_order)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) { toast.warning('Nama kategori wajib diisi'); return }
    try {
      if (editingId) {
        await updateCategory.mutateAsync({
          id: editingId,
          category_name: formName.trim(),
          sales_coa_id: formSalesCoaId || null,
          cogs_coa_id: formCogsCoaId || null,
          sort_order: formSortOrder,
        })
        toast.success('Kategori diupdate')
      } else {
        if (!formCode.trim()) { toast.warning('Kode kategori wajib diisi'); return }
        await createCategory.mutateAsync({
          category_code: formCode.trim().toUpperCase(),
          category_name: formName.trim(),
          sales_coa_id: formSalesCoaId || null,
          cogs_coa_id: formCogsCoaId || null,
          sort_order: formSortOrder,
        })
        toast.success('Kategori dibuat')
      }
      resetForm()
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan kategori')) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await deleteCategory.mutateAsync(deleteTarget.id); toast.success('Kategori dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus kategori')) }
    finally { setDeleteTarget(null) }
  }

  // Group COA options by type for easier selection
  const revenueCoas = (coaOptions.data || []).filter(c => c.account_code.startsWith('4'))
  const cogsCoas = (coaOptions.data || []).filter(c => c.account_code.startsWith('5'))

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-indigo-600 rounded-xl"><FolderKanban className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Kategori Menu</h1>
          <p className="text-xs text-gray-400">Kelola kategori untuk pengelompokan menu dan mapping COA</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">{editingId ? '✏️ Edit Kategori' : '➕ Kategori Baru'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kode Kategori</label>
              <input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="cth: FOOD" disabled={!!editingId}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama Kategori</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="cth: Makanan"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Akun Penjualan (Sales COA)</label>
              <select value={formSalesCoaId} onChange={e => setFormSalesCoaId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">— Tidak dipilih —</option>
                {revenueCoas.map(c => <option key={c.id} value={c.id}>{c.account_code} — {c.account_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Akun HPP (COGS COA)</label>
              <select value={formCogsCoaId} onChange={e => setFormCogsCoaId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">— Tidak dipilih —</option>
                {cogsCoas.map(c => <option key={c.id} value={c.id}>{c.account_code} — {c.account_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urutan</label>
              <input type="number" value={formSortOrder} onChange={e => setFormSortOrder(Number(e.target.value))} min={0}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createCategory.isPending || updateCategory.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {editingId ? 'Update' : 'Simpan'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg">Batal</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Akun Penjualan</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Akun HPP</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Urutan</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {categories.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
              ))
            ) : (categories.data || []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada kategori</td></tr>
            ) : (categories.data || []).map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.category_code}</td>
                <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">{c.category_name}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{c.sales_coa_code ? `${c.sales_coa_code} — ${c.sales_coa_name}` : '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{c.cogs_coa_code ? `${c.cogs_coa_code} — ${c.cogs_coa_name}` : '—'}</td>
                <td className="px-4 py-2.5 text-center text-gray-500">{c.sort_order}</td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => startEdit(c)} className="p-1 text-gray-400 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteTarget({ id: c.id, name: c.category_name })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Kategori" message={`Yakin ingin menghapus kategori "${deleteTarget?.name}"?`} confirmText="Hapus" variant="danger" isLoading={deleteCategory.isPending} />
    </div>
  )
}
