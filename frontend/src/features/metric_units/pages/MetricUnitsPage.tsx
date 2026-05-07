import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ruler, Plus, Search, Filter, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useMetricUnits, useMetricUnitFilterOptions, useDeleteMetricUnit, useRestoreMetricUnit } from '../api/metricUnits.api'
import { MetricUnitTable } from '../components/MetricUnitTable'
import type { MetricUnit, FilterParams } from '../types'

export default function MetricUnitsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [metricType, setMetricType] = useState('')
  const [isActive, setIsActive] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [unitToDelete, setUnitToDelete] = useState<MetricUnit | null>(null)
  const [unitToRestore, setUnitToRestore] = useState<MetricUnit | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const filter = useMemo((): FilterParams | null => {
    const f: FilterParams = {}
    if (debouncedSearch) f.q = debouncedSearch
    if (metricType) f.metric_type = metricType as FilterParams['metric_type']
    if (isActive) f.is_active = isActive === 'true'
    return Object.keys(f).length > 0 ? f : null
  }, [debouncedSearch, metricType, isActive])

  const { data, isLoading } = useMetricUnits({ page, limit, filter })
  const { data: filterOptions } = useMetricUnitFilterOptions()
  const deleteUnit = useDeleteMetricUnit()
  const restoreUnit = useRestoreMetricUnit()

  const metricUnits = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const activeFilterCount = (metricType ? 1 : 0) + (isActive ? 1 : 0)

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return
    try {
      await deleteUnit.mutateAsync(unitToDelete.id)
      toast.success('Satuan berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus satuan')) }
    finally { setUnitToDelete(null) }
  }

  const handleConfirmRestore = async () => {
    if (!unitToRestore) return
    try {
      await restoreUnit.mutateAsync(unitToRestore.id)
      toast.success('Satuan berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan satuan')) }
    finally { setUnitToRestore(null) }
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
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/metric-units/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Satuan
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari nama satuan..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilter ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
          </button>
        </div>
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={metricType} onChange={e => { setMetricType(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Tipe</option>
              {filterOptions?.metric_types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Tidak Aktif</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <MetricUnitTable metricUnits={metricUnits} loading={isLoading}
            onEdit={id => navigate(`/metric-units/${id}/edit`)} onDelete={setUnitToDelete} onRestore={setUnitToRestore} />
        </div>
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={metricUnits.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!unitToDelete} onClose={() => setUnitToDelete(null)} onConfirm={handleConfirmDelete}
        title="Hapus Satuan" message={`Yakin ingin menghapus "${unitToDelete?.unit_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteUnit.isPending} />
      <ConfirmModal isOpen={!!unitToRestore} onClose={() => setUnitToRestore(null)} onConfirm={handleConfirmRestore}
        title="Pulihkan Satuan" message={`Yakin ingin memulihkan "${unitToRestore?.unit_name}"?`}
        confirmText="Pulihkan" variant="success" isLoading={restoreUnit.isPending} />
    </div>
  )
}
