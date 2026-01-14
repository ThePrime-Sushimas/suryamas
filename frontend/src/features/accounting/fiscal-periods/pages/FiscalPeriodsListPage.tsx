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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Fiscal Periods</h1>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExport}
            className="px-4 py-2 border rounded hover:bg-gray-50 transition"
          >
            Export
          </button>
          <button
            onClick={() => navigate('/accounting/fiscal-periods/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Create Period
          </button>
        </div>
      </div>

      {/* Warning: No Open Period */}
      {!hasOpenPeriod && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm md:text-base">
          <p className="font-medium text-yellow-800">⚠️ No Open Fiscal Period</p>
          <p className="text-yellow-700 mt-1">
            Journal posting is currently disabled. Please open a fiscal period to continue.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm md:text-base">
          <p className="text-red-700">{error}</p>
          <button
            onClick={clearError}
            className="text-red-600 underline mt-2 text-sm hover:text-red-800 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded p-4 shadow">
        <FiscalPeriodFilters />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded shadow">
        {loading ? (
          <div className="text-center py-12 text-gray-500 text-lg">Loading Fiscal Periods...</div>
        ) : (
          <FiscalPeriodTable
            periods={periods}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onRefresh={fetchPeriods}
            canUpdate={true}
            canDelete={true}
          />
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4 flex-wrap">
          <button
            onClick={() => { setPage(pagination.page - 1); fetchPeriods() }}
            disabled={!pagination.hasPrev}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50 transition"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.totalPages}</span>
          </span>
          <button
            onClick={() => { setPage(pagination.page + 1); fetchPeriods() }}
            disabled={!pagination.hasNext}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// Previous version using card grid layout
// import { useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
// import { FiscalPeriodFilters } from '../components/FiscalPeriodFilters'
// import { StatusBadge } from '../components/StatusBadge'
// import { ClosePeriodModal } from '../components/ClosePeriodModal'
// import type { FiscalPeriodWithDetails } from '../types/fiscal-period.types'

// export function FiscalPeriodsListPage() {
//   const navigate = useNavigate()
//   const {
//     periods,
//     loading,
//     error,
//     pagination,
//     fetchPeriods,
//     deletePeriod,
//     restorePeriod,
//     exportPeriods,
//     setPage,
//     clearError,
//   } = useFiscalPeriodsStore()

//   const [closingPeriod, setClosingPeriod] = useState<FiscalPeriodWithDetails | null>(null)

//   const handleEdit = (period: FiscalPeriodWithDetails) => {
//     navigate(`/accounting/fiscal-periods/${period.id}/edit`)
//   }

//   const handleDelete = async (id: string) => {
//     if (confirm('Are you sure you want to delete this period?')) {
//       await deletePeriod(id)
//       fetchPeriods()
//     }
//   }

//   const handleRestore = async (id: string) => {
//     await restorePeriod(id)
//     fetchPeriods()
//   }

//   const handleExport = async () => {
//     await exportPeriods()
//   }

//   const handleCloseSuccess = () => {
//     setClosingPeriod(null)
//     fetchPeriods()
//   }

//   const hasOpenPeriod = periods.some(p => p.is_open && !p.deleted_at)

//   const formatDate = (date: string) => {
//     const d = new Date(date)
//     return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID')
//   }

//   return (
//     <div className="p-6 max-w-6xl mx-auto space-y-6">
//       {/* Header */}
//       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
//         <h1 className="text-2xl font-bold">Fiscal Periods</h1>
//         <div className="flex gap-3 flex-wrap">
//           <button
//             onClick={handleExport}
//             className="px-4 py-2 border rounded hover:bg-gray-50 transition"
//           >
//             Export
//           </button>
//           <button
//             onClick={() => navigate('/accounting/fiscal-periods/new')}
//             className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
//           >
//             Create Period
//           </button>
//         </div>
//       </div>

//       {/* Warning: No Open Period */}
//       {!hasOpenPeriod && (
//         <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm md:text-base">
//           <p className="font-medium text-yellow-800">⚠️ No Open Fiscal Period</p>
//           <p className="text-yellow-700 mt-1">
//             Journal posting is currently disabled. Please open a fiscal period to continue.
//           </p>
//         </div>
//       )}

//       {/* Error */}
//       {error && (
//         <div className="bg-red-50 border border-red-200 rounded p-4 text-sm md:text-base">
//           <p className="text-red-700">{error}</p>
//           <button
//             onClick={clearError}
//             className="text-red-600 underline mt-2 text-sm hover:text-red-800 transition"
//           >
//             Dismiss
//           </button>
//         </div>
//       )}

//       {/* Filters */}
//       <div className="bg-white border border-gray-200 rounded p-4 shadow">
//         <FiscalPeriodFilters />
//       </div>

//       {/* Card Grid */}
//       {loading ? (
//         <div className="text-center py-12 text-gray-500 text-lg">Loading Fiscal Periods...</div>
//       ) : (
//         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//           {periods.map((period) => (
//             <div
//               key={period.id}
//               className={`border rounded-lg p-4 shadow-sm flex flex-col justify-between ${
//                 period.deleted_at ? 'bg-gray-50 opacity-70' : 'bg-white'
//               }`}
//             >
//               <div>
//                 <h2 className="text-lg font-semibold mb-1">{period.period}</h2>
//                 <p className="text-sm text-gray-600 mb-1">Fiscal Year: {period.fiscal_year}</p>
//                 <p className="text-sm text-gray-600 mb-1">
//                   {formatDate(period.period_start)} - {formatDate(period.period_end)}
//                 </p>
//                 <div className="mb-1">
//                   <StatusBadge isOpen={period.is_open} />
//                 </div>
//                 <div className="flex gap-2 text-sm text-gray-700 mt-1">
//                   {period.is_year_end && <span className="text-green-600">✓ Year End</span>}
//                   {period.is_adjustment_allowed && <span className="text-blue-600">✓ Adjustment Allowed</span>}
//                   {period.deleted_at && <span className="text-red-600">Deleted</span>}
//                 </div>
//               </div>

//               {/* Action Buttons */}
//               <div className="mt-4 flex gap-2 flex-wrap">
//                 {period.deleted_at ? (
//                   <button
//                     onClick={() => handleRestore(period.id)}
//                     className="px-3 py-1 text-green-600 border rounded hover:bg-green-50 transition"
//                   >
//                     Restore
//                   </button>
//                 ) : (
//                   <>
//                     {period.is_open && (
//                       <>
//                         <button
//                           onClick={() => handleEdit(period)}
//                           className="px-3 py-1 text-blue-600 border rounded hover:bg-blue-50 transition"
//                         >
//                           Edit
//                         </button>
//                         <button
//                           onClick={() => setClosingPeriod(period)}
//                           className="px-3 py-1 text-orange-600 border rounded hover:bg-orange-50 transition"
//                         >
//                           Close
//                         </button>
//                         <button
//                           onClick={() => handleDelete(period.id)}
//                           className="px-3 py-1 text-red-600 border rounded hover:bg-red-50 transition"
//                         >
//                           Delete
//                         </button>
//                       </>
//                     )}
//                   </>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       {/* Pagination */}
//       {pagination.totalPages > 1 && (
//         <div className="flex justify-center items-center gap-3 mt-4 flex-wrap">
//           <button
//             onClick={() => { setPage(pagination.page - 1); fetchPeriods() }}
//             disabled={!pagination.hasPrev}
//             className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50 transition"
//           >
//             Previous
//           </button>
//           <span className="px-4 py-2">
//             Page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.totalPages}</span>
//           </span>
//           <button
//             onClick={() => { setPage(pagination.page + 1); fetchPeriods() }}
//             disabled={!pagination.hasNext}
//             className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50 transition"
//           >
//             Next
//           </button>
//         </div>
//       )}

//       {/* Close Period Modal */}
//       {closingPeriod && (
//         <ClosePeriodModal
//           period={closingPeriod}
//           isOpen={true}
//           onClose={() => setClosingPeriod(null)}
//           onSuccess={handleCloseSuccess}
//         />
//       )}
//     </div>
//   )
// }
