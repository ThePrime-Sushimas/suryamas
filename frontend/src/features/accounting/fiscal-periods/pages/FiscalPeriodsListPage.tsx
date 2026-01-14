import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodFilters } from '../components/FiscalPeriodFilters'
import { FiscalPeriodTable } from '../components/FiscalPeriodTable'
import type { FiscalPeriodWithDetails } from '../types/fiscal-period.types'

export function FiscalPeriodsListPage() {
  const navigate = useNavigate()
  const {
    periods,
    loading,
    error,
    pagination,
    fetchPeriods,
    deletePeriod,
    restorePeriod,
    exportPeriods,
    setPage,
    clearError,
  } = useFiscalPeriodsStore()

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  const handleEdit = (period: FiscalPeriodWithDetails) => {
    navigate(`/accounting/fiscal-periods/${period.id}/edit`)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this period?')) {
      await deletePeriod(id)
    }
  }

  const handleRestore = async (id: string) => {
    await restorePeriod(id)
  }

  const handleExport = async () => {
    await exportPeriods()
  }

  const hasOpenPeriod = periods.some(p => p.is_open && !p.deleted_at)

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Fiscal Periods</h1>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Export
          </button>
          <button
            onClick={() => navigate('/accounting/fiscal-periods/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Period
          </button>
        </div>
      </div>

      {!hasOpenPeriod && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="font-medium text-yellow-800">⚠️ No Open Fiscal Period</p>
          <p className="text-sm text-yellow-700">Journal posting is currently disabled. Please open a fiscal period.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-700">{error}</p>
          <button onClick={clearError} className="text-sm text-red-600 underline mt-2">
            Dismiss
          </button>
        </div>
      )}

      <FiscalPeriodFilters />

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          <FiscalPeriodTable
            periods={periods}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onRefresh={fetchPeriods}
            canUpdate={true}
            canDelete={true}
          />

          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => { setPage(pagination.page - 1); fetchPeriods() }}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => { setPage(pagination.page + 1); fetchPeriods() }}
                disabled={!pagination.hasNext}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
