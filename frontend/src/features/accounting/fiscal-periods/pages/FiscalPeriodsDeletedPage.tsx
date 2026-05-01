import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodTable } from '../components/FiscalPeriodTable'
import { Pagination } from '@/components/ui/Pagination'

export function FiscalPeriodsDeletedPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { periods, loading, pagination, fetchPeriods, restorePeriod, setFilters, setPage, setLimit } = useFiscalPeriodsStore()

  useEffect(() => {
    setFilters({ show_deleted: true })
  }, [setFilters])

  const deletedPeriods = periods.filter(p => p.deleted_at)

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchPeriods()
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    fetchPeriods()
  }

  const paginationInfo = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasNext: pagination.hasNext,
    hasPrev: pagination.hasPrev,
  }

  return (
    <div className="px-4 py-6 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deleted Fiscal Periods</h1>
        <button
          onClick={() => navigate('/accounting/fiscal-periods')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Back to List
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : deletedPeriods.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No deleted periods</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow">
            <FiscalPeriodTable
              periods={deletedPeriods}
              onEdit={() => {}}
              onDelete={() => {}}
              onRestore={async (id: string) => {
                try {
                  await restorePeriod(id)
                  toast.success('Fiscal period berhasil direstore')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Gagal merestore')
                }
              }}
              onRefresh={fetchPeriods}
              canUpdate={true}
              canDelete={false}
            />
          </div>

          {/* Global Pagination */}
          {pagination.totalPages > 1 && (
            <Pagination
              pagination={paginationInfo}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              loading={loading}
            />
          )}
        </>
      )}
    </div>
  )
}
