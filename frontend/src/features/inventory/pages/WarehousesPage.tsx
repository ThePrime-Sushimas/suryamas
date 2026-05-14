import { useState, useMemo } from 'react'
import { Warehouse as WarehouseIcon, Plus, Search, X, Trash2, Pencil } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse } from '../api/inventory.api'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Warehouse, WarehouseType } from '../types'

const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  MAIN: 'Gudang Utama',
  READY: 'Gudang Ready',
  CENTRAL_STOCK: 'Central Stock',
  CENTRAL_KITCHEN: 'Central Kitchen',
}

const WAREHOUSE_TYPE_COLORS: Record<WarehouseType, string> = {
  MAIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  READY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CENTRAL_STOCK: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  CENTRAL_KITCHEN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

export default function WarehousesPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Warehouse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<WarehouseType>('MAIN')
  const [formBranchId, setFormBranchId] = useState('')

  const debouncedSearch = useDebounce(search, 400)

  const { data: branchesData } = useQuery({
    queryKey: ['branches', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/branches', { params: { status: 'active', limit: 50 } })
      return data.data as { id: string; branch_name: string; branch_code: string }[]
    },
    staleTime: 120_000,
  })
  const branches = branchesData ?? []

  const queryParams = useMemo(() => ({
    page, limit: 25, search: debouncedSearch || undefined,
    warehouse_type: typeFilter || undefined,
  }), [page, debouncedSearch, typeFilter])

  const { data, isLoading } = useWarehouses(queryParams)
  const createWarehouse = useCreateWarehouse()
  const updateWarehouse = useUpdateWarehouse()
  const deleteWarehouse = useDeleteWarehouse()

  const warehouses = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleTypeChange = (v: string) => { setTypeFilter(v); setPage(1) }

  const openCreate = () => {
    setEditTarget(null)
    setFormCode(''); setFormName(''); setFormType('MAIN'); setFormBranchId('')
    setShowForm(true)
  }

  const openEdit = (w: Warehouse) => {
    setEditTarget(w)
    setFormCode(w.warehouse_code); setFormName(w.warehouse_name); setFormType(w.warehouse_type); setFormBranchId(w.branch_id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editTarget) {
        await updateWarehouse.mutateAsync({ id: editTarget.id, warehouse_name: formName, warehouse_type: formType })
        toast.success('Gudang berhasil diperbarui')
      } else {
        await createWarehouse.mutateAsync({ branch_id: formBranchId, warehouse_code: formCode, warehouse_name: formName, warehouse_type: formType })
        toast.success('Gudang berhasil dibuat')
      }
      setShowForm(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan gudang')) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteWarehouse.mutateAsync(deleteTarget.id)
      toast.success('Gudang berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus gudang')) }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WarehouseIcon className="w-6 h-6 text-purple-600 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Gudang</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} gudang</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Tambah Gudang</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari gudang..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <select value={typeFilter} onChange={e => handleTypeChange(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="">Semua Tipe</option>
            {Object.entries(WAREHOUSE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="bg-purple-50 dark:bg-purple-900/10 border-b border-purple-200 dark:border-purple-800 px-4 sm:px-6 py-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {!editTarget && (
              <select value={formBranchId} onChange={e => setFormBranchId(e.target.value)} required
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                <option value="">Pilih Cabang *</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            )}
            {!editTarget && (
              <input type="text" placeholder="Kode Gudang *" value={formCode} onChange={e => setFormCode(e.target.value)} required
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            )}
            <input type="text" placeholder="Nama Gudang *" value={formName} onChange={e => setFormName(e.target.value)} required
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <select value={formType} onChange={e => setFormType(e.target.value as WarehouseType)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              {Object.entries(WAREHOUSE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <button type="submit" disabled={createWarehouse.isPending || updateWarehouse.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50">
                {editTarget ? 'Simpan' : 'Buat'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama Gudang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : warehouses.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Tidak ada gudang ditemukan</td></tr>
                ) : warehouses.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-200">{w.warehouse_code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{w.warehouse_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{w.branch_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${WAREHOUSE_TYPE_COLORS[w.warehouse_type]}`}>
                        {WAREHOUSE_TYPE_LABELS[w.warehouse_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {w.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(w)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget(w)} className="text-red-500 hover:text-red-700 dark:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
              </div>
            ) : warehouses.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada gudang ditemukan</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {warehouses.map(w => (
                  <div key={w.id} className="p-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{w.warehouse_name}</p>
                      <p className="text-xs text-gray-500">{w.warehouse_code} · {w.branch_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${WAREHOUSE_TYPE_COLORS[w.warehouse_type]}`}>
                          {WAREHOUSE_TYPE_LABELS[w.warehouse_type]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600'}`}>
                          {w.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(w)} className="p-1.5 text-blue-600 dark:text-blue-400"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(w)} className="p-1.5 text-red-500 dark:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={warehouses.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Gudang" message={`Yakin ingin menghapus "${deleteTarget?.warehouse_name}"? Gudang yang memiliki stok tidak bisa dihapus.`}
        confirmText="Hapus" variant="danger" isLoading={deleteWarehouse.isPending} />
    </div>
  )
}
