import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodTable } from '../components/FiscalPeriodTable'

export function FiscalPeriodsDeletedPage() {
  const navigate = useNavigate()
  const { periods, loading, fetchPeriods, restorePeriod, setFilters } = useFiscalPeriodsStore()

  useEffect(() => {
    setFilters({ show_deleted: true })
  }, [setFilters])

  const deletedPeriods = periods.filter(p => p.deleted_at)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Deleted Fiscal Periods</h1>
        <button
          onClick={() => navigate('/accounting/fiscal-periods')}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Back to List
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : deletedPeriods.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No deleted periods</div>
      ) : (
        <FiscalPeriodTable
          periods={deletedPeriods}
          onEdit={() => {}}
          onDelete={() => {}}
          onRestore={restorePeriod}
          onRefresh={fetchPeriods}
          canUpdate={true}
          canDelete={false}
        />
      )}
    </div>
  )
}
