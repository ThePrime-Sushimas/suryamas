import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitTable } from '../components/MetricUnitTable'
import { useToast } from '@/contexts/ToastContext'
import Pagination from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Ruler, Plus, Search, Filter, X, RefreshCw } from 'lucide-react'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import type { MetricUnit, FilterParams } from '../types'

export default function MetricUnitsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    metricUnits, loading, mutationLoading, pagination, error,
    filterOptions, fetchPage, deleteMetricUnit, restoreMetricUnit,
    fetchFilterOptions, clearError
  } = useMetricUnitsStore()

  const [search, setSearch] = useState('')
  const [metricType, setMetricType] = useState('')
  const [isActive, setIsActive] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [unitToDelete, setUnitToDelete] = useState<MetricUnit | null>(null)
  const [unitToRestore, setUnitToRestore] = useState<MetricUnit | null>(null)

  const debouncedSearch = useDebounce(search, 500)

  useEffect(() => { fetchFilterOptions() }, [fetchFilterOptions])

  const buildFilter = useCallback((): FilterParams | null => {
    const f: FilterParams = {}
    if (debouncedSearch) f.q = debouncedSearch
    if (metricType) f.metric_type = metricType as FilterParams['metric_type']
    if (isActive) f.is_active = isActive === 'true'
    return Object.keys(f).length > 0 ? f : null
  }, [debouncedSearch, metricType, isActive])

  const doFetch = useCallback((page: number, limit?: number) => {
    fetchPage(page, limit, undefined, buildFilter())
  }, [fetchPage, buildFilter])

  // Search/filter changes → reset to page 1
  useEffect(() => {
    doFetch(1)
  }, [debouncedSearch, metricType, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = useMemo(() => (metricType ? 1 : 0) + (isActive ? 1 : 0), [metricType, isActive])

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return
    try {
      await deleteMetricUnit(unitToDelete.id)
      toast.success('Satuan berhasil dihapus')
      setUnitToDelete(null)
      doFetch(pagination.page)
    } catch {
      toast.error('Gagal menghapus satuan')
    }
  }

  const handleConfirmRestore = async () => {
    if (!unitToRestore) return
    try {
      await restoreMetricUnit(unitToRestore.id)
      toast.success('Satuan berhasil dipulihkan')
      setUnitToRestore(null)
      doFetch(pagination.page)
    } catch {
      toast.error('Gagal memulihkan satuan')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ruler className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Satuan Ukur</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/metric-units/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Satuan
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama satuan atau catatan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Satuan</label>
              <select
                value={metricType}
                onChange={e => setMetricType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Semua Tipe</option>
                {filterOptions?.metric_types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={isActive}
                onChange={e => setIsActive(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Semua Status</option>
                <option value="true">Aktif</option>
                <option value="false">Tidak Aktif</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>Terjadi kesalahan saat memuat data</span>
          <button
            onClick={() => { clearError(); doFetch(pagination.page) }}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 dark:bg-red-800 rounded-lg hover:bg-red-200 dark:hover:bg-red-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <MetricUnitTable
            metricUnits={metricUnits}
            loading={loading}
            onEdit={id => navigate(`/metric-units/${id}/edit`)}
            onDelete={setUnitToDelete}
            onRestore={setUnitToRestore}
          />
        </div>

        {pagination.total > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={(p) => doFetch(p)}
            onLimitChange={(l) => doFetch(1, l)}
            currentLength={metricUnits.length}
            loading={loading}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={!!unitToDelete}
        onClose={() => setUnitToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Satuan"
        message={`Yakin ingin menghapus "${unitToDelete?.unit_name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={mutationLoading}
      />

      <ConfirmModal
        isOpen={!!unitToRestore}
        onClose={() => setUnitToRestore(null)}
        onConfirm={handleConfirmRestore}
        title="Pulihkan Satuan"
        message={`Yakin ingin memulihkan "${unitToRestore?.unit_name}"?`}
        confirmText="Pulihkan"
        cancelText="Batal"
        variant="success"
        isLoading={mutationLoading}
      />
    </div>
  )
}
