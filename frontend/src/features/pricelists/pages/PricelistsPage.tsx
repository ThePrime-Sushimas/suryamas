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
import { PriceChangeHistorySection } from '../components/PriceChangeHistorySection'
import type { PricelistListQuery } from '../types/pricelist.types'

type TabKey = 'active' | 'history'

export default function PricelistsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('active')
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

  const { data, isLoading } = usePricelists(query, { enabled: activeTab === 'active' })
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Pricelist</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kelola harga aktif supplier dan riwayat perubahan otomatis dari invoice
            </p>
          </div>
          <button
            onClick={() => navigate('/pricelists/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-medium shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah Pricelist
          </button>
        </div>

        {/* Tabs */}
        <div className="inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          {([
            { key: 'active' as const, label: 'Harga Aktif' },
            { key: 'history' as const, label: 'Riwayat' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'active' ? (
          <>
            {/* Search & Filter */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 lg:p-6 shadow-sm space-y-4">
              <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Harga Aktif</p>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari supplier atau produk..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {search && (
                    <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2 transition-colors ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>
                  )}
                </button>
              </div>

              {showFilters && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                    <option value="">Semua Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                  <select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                    <option value="">Semua</option>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                  <input type="date" value={validOn} onChange={(e) => { setValidOn(e.target.value); setPage(1) }}
                    className="px-3 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1) }}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600" />
                    Tampilkan Terhapus
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-500" />
                <span className="text-sm text-gray-500">{pagination?.total ?? 0} pricelist</span>
              </div>
              <div className="p-4 lg:p-6">
                <PricelistTable
                  data={pricelists}
                  loading={isLoading}
                  onEdit={(id) => navigate(`/pricelists/${id}/edit`)}
                  onDelete={setDeleteId}
                  onRestore={setRestoreId}
                  onApprove={handleApprove}
                  onView={(id) => navigate(`/pricelists/${id}`)}
                  onSort={() => {}}
                />
                {pagination && pagination.total > 0 && (
                  <div className="mt-6">
                    <Pagination
                      pagination={pagination}
                      onPageChange={setPage}
                      onLimitChange={(l) => { setLimit(l); setPage(1) }}
                      currentLength={pricelists.length}
                      loading={isLoading}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <PriceChangeHistorySection />
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
