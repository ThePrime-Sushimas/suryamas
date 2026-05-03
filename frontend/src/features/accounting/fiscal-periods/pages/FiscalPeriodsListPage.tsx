import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodFilters } from '../components/FiscalPeriodFilters'
import { FiscalPeriodTable } from '../components/FiscalPeriodTable'
import { ClosePeriodModal } from '../components/ClosePeriodModal'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { FiscalPeriodWithDetails } from '../types/fiscal-period.types'

export function FiscalPeriodsListPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canUpdate = hasPermission('fiscal_periods', 'update')
  const canDelete = hasPermission('fiscal_periods', 'delete')
  const canInsert = hasPermission('fiscal_periods', 'insert')
  const canClose = hasPermission('fiscal_periods', 'release')
  const canReopen = hasPermission('fiscal_periods', 'approve')

  const {
    periods, loading, error, pagination,
    fetchPeriods, deletePeriod, restorePeriod, reopenPeriod, exportPeriods,
    setPage, setLimit, clearError,
  } = useFiscalPeriodsStore()

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; periodId: string | null }>({ isOpen: false, periodId: null })
  const [closingPeriod, setClosingPeriod] = useState<FiscalPeriodWithDetails | null>(null)
  const [reopenConfirm, setReopenConfirm] = useState<{ isOpen: boolean; period: FiscalPeriodWithDetails | null }>({ isOpen: false, period: null })

  useEffect(() => { fetchPeriods() }, [fetchPeriods])

  const handleEdit = (period: FiscalPeriodWithDetails) => navigate(`/accounting/fiscal-periods/${period.id}/edit`)

  const handleDeleteClick = (id: string) => setConfirmModal({ isOpen: true, periodId: id })

  const handleDeleteConfirm = async () => {
    if (confirmModal.periodId) {
      try {
        await deletePeriod(confirmModal.periodId)
        toast.success('Fiscal period berhasil dihapus')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menghapus fiscal period')
      }
    }
    setConfirmModal({ isOpen: false, periodId: null })
  }

  const handleRestore = async (id: string) => {
    try {
      await restorePeriod(id)
      toast.success('Fiscal period berhasil direstore')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal merestore fiscal period')
    }
  }

  const handleExport = async () => {
    try {
      await exportPeriods()
      toast.success('Export berhasil')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal export')
    }
  }

  const handlePageChange = (newPage: number) => { setPage(newPage); fetchPeriods() }
  const handleLimitChange = (newLimit: number) => { setLimit(newLimit); fetchPeriods() }

  const handleCloseSuccess = () => {
    setClosingPeriod(null)
    fetchPeriods()
  }

  const handleReopenConfirm = async () => {
    if (reopenConfirm.period) {
      try {
        await reopenPeriod(reopenConfirm.period.id, { reopen_reason: `Reopen periode ${reopenConfirm.period.period}` })
        toast.success(`Periode ${reopenConfirm.period.period} berhasil dibuka kembali`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal membuka kembali periode')
      }
    }
    setReopenConfirm({ isOpen: false, period: null })
  }

  const hasOpenPeriod = periods?.some(p => p.is_open && !p.deleted_at) ?? false

  const paginationInfo = {
    page: pagination.page, limit: pagination.limit, total: pagination.total,
    totalPages: pagination.totalPages, hasNext: pagination.hasNext, hasPrev: pagination.hasPrev,
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fiscal Periods</h1>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleExport}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">
            Export
          </button>
          {canInsert && (
            <button onClick={() => navigate('/accounting/fiscal-periods/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              Create Period
            </button>
          )}
        </div>
      </div>

      {!hasOpenPeriod && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4 text-sm md:text-base">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">⚠️ No Open Fiscal Period</p>
          <p className="text-yellow-700 dark:text-yellow-400 mt-1">Journal posting is currently disabled. Please open a fiscal period to continue.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 text-sm md:text-base">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button onClick={clearError} className="text-red-600 dark:text-red-400 underline mt-2 text-sm hover:text-red-800 dark:hover:text-red-300 transition">Dismiss</button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 shadow">
        <FiscalPeriodFilters />
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow">
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-lg">Loading Fiscal Periods...</div>
        ) : (
          <FiscalPeriodTable
            periods={periods || []}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onRestore={handleRestore}
            onClose={canClose ? (period) => setClosingPeriod(period) : undefined}
            onReopen={canReopen ? (period) => setReopenConfirm({ isOpen: true, period }) : undefined}
            onRefresh={fetchPeriods}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canClose={canClose}
            canReopen={canReopen}
          />
        )}
      </div>

      {pagination.totalPages > 1 && (
        <Pagination pagination={paginationInfo} onPageChange={handlePageChange} onLimitChange={handleLimitChange} loading={loading} />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, periodId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Fiscal Period"
        message="Are you sure you want to delete this fiscal period? This action cannot be undone."
        confirmText="Delete" cancelText="Cancel" variant="danger"
      />

      {closingPeriod && (
        <ClosePeriodModal period={closingPeriod} isOpen={true} onClose={() => setClosingPeriod(null)} onSuccess={handleCloseSuccess} />
      )}

      <ConfirmModal
        isOpen={reopenConfirm.isOpen}
        onClose={() => setReopenConfirm({ isOpen: false, period: null })}
        onConfirm={handleReopenConfirm}
        title="Buka Kembali Periode"
        message={`Apakah Anda yakin ingin membuka kembali periode ${reopenConfirm.period?.period ?? ''}? Closing journal akan di-reverse dan periode bisa menerima jurnal baru.`}
        confirmText="Buka Kembali" cancelText="Batal" variant="warning"
      />
    </div>
  )
}
