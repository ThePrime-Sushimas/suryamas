import { useState } from 'react'
import { Layers, Plus, Pencil, Trash2, Check } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useMenuCategories, useMenuGroups, useCreateMenuGroup, useUpdateMenuGroup, useDeleteMenuGroup } from '../api/food-production.api'
import type { MenuGroup } from '../types/food-production.types'

export default function MenuGroupsPage() {
  const toast = useToast()
  const categories = useMenuCategories()
  const [filterCategory, setFilterCategory] = useState('')
  const groups = useMenuGroups(filterCategory ? { category_id: filterCategory } : {})
  const createGroup = useCreateMenuGroup()
  const updateGroup = useUpdateMenuGroup()
  const deleteGroup = useDeleteMenuGroup()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const resetForm = () => { setShowForm(false); setEditingId(null); setFormCode(''); setFormName(''); setFormCategoryId(''); setFormSortOrder(0) }

  const startEdit = (g: MenuGroup) => {
    setEditingId(g.id); setFormCode(g.group_code); setFormName(g.group_name); setFormCategoryId(g.category_id); setFormSortOrder(g.sort_order)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formCategoryId) { toast.warning('Nama dan kategori wajib diisi'); return }
    try {
      if (editingId) {
        await updateGroup.mutateAsync({ id: editingId, category_id: formCategoryId, group_name: formName.trim(), sort_order: formSortOrder })
        toast.success('Group diupdate')
      } else {
        if (!formCode.trim()) { toast.warning('Kode group wajib diisi'); return }
        await createGroup.mutateAsync({ category_id: formCategoryId, group_code: formCode.trim().toUpperCase(), group_name: formName.trim(), sort_order: formSortOrder })
        toast.success('Group dibuat')
      }
      resetForm()
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan group')) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await deleteGroup.mutateAsync(deleteTarget.id); toast.success('Group dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus group')) }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-teal-600 rounded-xl"><Layers className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Group Menu</h1>
          <p className="text-xs text-gray-400">Kelola group untuk sub-pengelompokan menu</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">Semua Kategori</option>
          {(categories.data || []).map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
        </select>
        <span className="text-xs text-gray-400">{groups.data?.length || 0} group</span>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">{editingId ? '✏️ Edit Group' : '➕ Group Baru'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="Kode (cth: SUSHI-ROLL)" disabled={!!editingId}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" />
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nama Group"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <select value={formCategoryId} onChange={e => setFormCategoryId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Pilih kategori...</option>
              {(categories.data || []).map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
            </select>
            <input type="number" value={formSortOrder} onChange={e => setFormSortOrder(Number(e.target.value))} min={0} placeholder="Urutan"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createGroup.isPending || updateGroup.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {createGroup.isPending || updateGroup.isPending ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
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
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Nama Group</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Urutan</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {groups.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
              ))
            ) : (groups.data || []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada group</td></tr>
            ) : (groups.data || []).map(g => (
              <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{g.group_code}</td>
                <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">{g.group_name}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{g.category_name}</td>
                <td className="px-4 py-2.5 text-center text-gray-500">{g.sort_order}</td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => startEdit(g)} className="p-1 text-gray-400 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteTarget({ id: g.id, name: g.group_name })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Group" message={`Yakin ingin menghapus group "${deleteTarget?.name}"?`} confirmText="Hapus" variant="danger" isLoading={deleteGroup.isPending} />
    </div>
  )
}
