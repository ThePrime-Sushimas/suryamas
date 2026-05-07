import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Plus, Search, X, Filter } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePricelists, useDeletePricelist, useRestorePricelist, useApprovePricelist } from '../api/pricelists.api'
import { PricelistTable } from '../components/PricelistTable'
import type { PricelistListQuery } from '../types/pricelist.types'

export default function PricelistsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [showFilters, setShowFilters] = useState(false)
  const [status, setStatus] = useState('')
  const [isActive, setIsActive] = useState('')
  const [validOn, setValidOn] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const query = useMemo((): PricelistListQuery => ({
    page, limit,
    search: debouncedSearch || undefined,
    status: status as PricelistListQuery['status'] || undefined,
    is_active: isActive ? isActive === 'true' : undefined,
    valid_on: validOn || undefined,
    include_deleted: includeDeleted || undefined,
  }), [page, limit, debouncedSearch, status, isActive, validOn, includeDeleted])

  const { data, isLoading } = usePricelists(query)
  const deletePL = useDeletePricelist()
  const restorePL = useRestorePricelist()
  const approvePL = useApprovePricelist()

  const pricelists = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const activeFilterCount = [status, isActive, validOn, includeDeleted].filter(Boolean).length

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deletePL.mutateAsync(deleteId)
      toast.success('Pricelist berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus pricelist')) }
    finally { setDeleteId(null) }
  }

  const handleRestore = async () => {
    if (!restoreId) return
    try {
      await restorePL.mutateAsync(restoreId)
      toast.success('Pricelist berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan pricelist')) }
    finally { setRestoreId(null) }
  }

  const handleApprove = async (id: string) => {
    try {
      await approvePL.mutateAsync({ id, status: 'APPROVED' })
      toast.success('Pricelist berhasil diapprove')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal approve pricelist')) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Daftar Harga</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/pricelists/new')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
            <Plus className="w-4 h-4" /> Tambah Pricelist
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari supplier atau produk..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilters || activeFilterCount > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="bg-green-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <select value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
            <input type="date" value={validOn} onChange={e => { setValidOn(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeDeleted} onChange={e => { setIncludeDeleted(e.target.checked); setPage(1) }}
                className="rounded border-gray-300 dark:border-gray-600 text-green-600 bg-white dark:bg-gray-700" />
              Tampilkan Terhapus
            </label>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <PricelistTable data={pricelists} loading={isLoading}
          onEdit={id => navigate(`/pricelists/${id}/edit`)}
          onDelete={setDeleteId}
          onRestore={setRestoreId}
          onApprove={handleApprove}
          onView={id => navigate(`/pricelists/${id}`)}
          onSort={() => {}} />
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={pricelists.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Hapus Pricelist" message="Yakin ingin menghapus pricelist ini?"
        confirmText="Hapus" variant="danger" isLoading={deletePL.isPending} />
      <ConfirmModal isOpen={!!restoreId} onClose={() => setRestoreId(null)} onConfirm={handleRestore}
        title="Pulihkan Pricelist" message="Yakin ingin memulihkan pricelist ini?"
        confirmText="Pulihkan" variant="success" isLoading={restorePL.isPending} />
    </div>
  )
}
