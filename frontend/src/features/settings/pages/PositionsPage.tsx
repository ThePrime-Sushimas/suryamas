import { useState } from 'react'
import { Users, Plus, Pencil, Trash2, Shield } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useDepartments, usePositions, useCreatePosition, useUpdatePosition, useDeletePosition } from '../api/settings.api'

export default function PositionsPage() {
  const toast = useToast()
  const departments = useDepartments()
  const [deptFilter, setDeptFilter] = useState('')
  const positions = usePositions(deptFilter || undefined)
  const createPos = useCreatePosition()
  const updatePos = useUpdatePosition()
  const deletePos = useDeletePosition()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deptId, setDeptId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [canAccessAll, setCanAccessAll] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const resetForm = () => { setShowForm(false); setEditId(null); setDeptId(''); setCode(''); setName(''); setCanAccessAll(false); setSortOrder(0) }

  const startEdit = (p: { id: string; department_id: string; position_code: string; position_name: string; can_access_all_wip: boolean; sort_order: number }) => {
    setEditId(p.id); setDeptId(p.department_id); setCode(p.position_code); setName(p.position_name); setCanAccessAll(p.can_access_all_wip); setSortOrder(p.sort_order); setShowForm(true)
  }

  const handleSave = async () => {
    if (!deptId || !code.trim() || !name.trim()) { toast.warning('Department, kode, dan nama wajib diisi'); return }
    try {
      if (editId) {
        await updatePos.mutateAsync({ id: editId, department_id: deptId, position_name: name, can_access_all_wip: canAccessAll, sort_order: sortOrder })
        toast.success('Position diupdate')
      } else {
        await createPos.mutateAsync({ department_id: deptId, position_code: code, position_name: name, can_access_all_wip: canAccessAll, sort_order: sortOrder })
        toast.success('Position dibuat')
      }
      resetForm()
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan position')) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try { await deletePos.mutateAsync(deleteId); toast.success('Position dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus position')) }
    finally { setDeleteId(null) }
  }

  const data = positions.data || []
  const deptList = departments.data || []

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-purple-600 rounded-xl"><Users className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Station</h1>
          <p className="text-xs text-gray-400">Kelola posisi karyawan per departemen</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </div>

      {/* Filter */}
      <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
        className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
        <option value="">Semua Departemen</option>
        {deptList.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
      </select>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">{editId ? '✏️ Edit' : '➕ Tambah'} Position</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Departemen *</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Pilih...</option>
                {deptList.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kode *</label>
              <input value={code} onChange={e => setCode(e.target.value)} disabled={!!editId} placeholder="SUSHIMAN"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nama *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Sushiman"
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urutan</label>
              <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={canAccessAll} onChange={e => setCanAccessAll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Akses semua WIP (bypass filter posisi)</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createPos.isPending || updatePos.isPending}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
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
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Departemen</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Karyawan</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">WIP All</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {positions.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Belum ada position</td></tr>
            ) : data.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.position_code}</td>
                <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium">{p.position_name}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{p.department_name}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{p.employee_count}</td>
                <td className="px-3 py-2.5 text-center">
                  {p.can_access_all_wip && <Shield className="w-3.5 h-3.5 text-emerald-500 mx-auto" />}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => startEdit(p)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(p.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Hapus Position" message="Yakin ingin menghapus position ini? Position yang masih di-assign ke employee atau WIP tidak bisa dihapus."
        confirmText="Hapus" variant="danger" />
    </div>
  )
}
