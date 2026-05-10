import { useState } from 'react'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from '../api/settings.api'

export default function DepartmentsPage() {
  const toast = useToast()
  const departments = useDepartments()
  const createDept = useCreateDepartment()
  const updateDept = useUpdateDepartment()
  const deleteDept = useDeleteDepartment()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const resetForm = () => { setShowForm(false); setEditId(null); setCode(''); setName(''); setSortOrder(0) }

  const startEdit = (d: { id: string; department_code: string; department_name: string; sort_order: number }) => {
    setEditId(d.id); setCode(d.department_code); setName(d.department_name); setSortOrder(d.sort_order); setShowForm(true)
  }

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) { toast.warning('Kode dan nama wajib diisi'); return }
    try {
      if (editId) {
        await updateDept.mutateAsync({ id: editId, department_name: name, sort_order: sortOrder })
        toast.success('Department diupdate')
      } else {
        await createDept.mutateAsync({ department_code: code, department_name: name, sort_order: sortOrder })
        toast.success('Department dibuat')
      }
      resetForm()
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan department')) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try { await deleteDept.mutateAsync(deleteId); toast.success('Department dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus department')) }
    finally { setDeleteId(null) }
  }

  const data = departments.data || []

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-blue-600 rounded-xl"><Building2 className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Departemen</h1>
          <p className="text-xs text-gray-400">Kelola departemen organisasi</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">{editId ? '✏️ Edit' : '➕ Tambah'} Department</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kode *</label>
              <input value={code} onChange={e => setCode(e.target.value)} disabled={!!editId} placeholder="KITCHEN"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Dapur"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urutan</label>
              <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createDept.isPending || updateDept.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {editId ? 'Update' : 'Simpan'}
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
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Posisi</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Urutan</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {departments.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Belum ada department</td></tr>
            ) : data.map(d => (
              <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{d.department_code}</td>
                <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium">{d.department_name}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{d.position_count}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{d.sort_order}</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => startEdit(d)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(d.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Hapus Department" message="Yakin ingin menghapus department ini? Department yang masih punya posisi tidak bisa dihapus."
        confirmText="Hapus" variant="danger" />
    </div>
  )
}
