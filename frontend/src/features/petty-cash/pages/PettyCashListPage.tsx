import { Plus, Search, X, Loader2 } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranches } from '@/features/branches/api/branches.api'
import { usePettyCashRequests } from '../hooks/pettyCash.api'
import { useCoaOptions } from '@/features/food-production/api/food-production.api'
import { PettyCashStatusBadge } from '../components/PettyCashStatusBadge'
import { PettyCashCreateModal } from '../components/PettyCashCreateModal'
import { useCreatePettyCashRequestForm } from '../hooks/useCreatePettyCashRequestForm'
import { pettyCashFilterConfig } from '../utils/pettyCashFilters.url'
import { fmtCurrency, fmtDate } from '../utils/pettyCash.formatters'
import { PETTY_CASH_STATUS_LABELS } from '../types/pettyCash.status'
import type { PettyCashRequestStatus } from '../types/pettyCash.types'

const STATUS_OPTIONS: Array<{ value: '' | PettyCashRequestStatus; label: string }> = [
  { value: '', label: 'Semua status' },
  { value: 'PENDING', label: PETTY_CASH_STATUS_LABELS.PENDING },
  { value: 'DISBURSED', label: PETTY_CASH_STATUS_LABELS.DISBURSED },
  { value: 'CLOSED', label: PETTY_CASH_STATUS_LABELS.CLOSED },
  { value: 'REJECTED', label: PETTY_CASH_STATUS_LABELS.REJECTED },
]

export default function PettyCashListPage() {
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('petty_cash', 'insert')

  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters(pettyCashFilterConfig)
  const { openDetail } = useListNavigation('/finance/petty-cash')

  const { data, isLoading } = usePettyCashRequests({
    branch_id: filters.branch_id || undefined,
    status: (filters.status as PettyCashRequestStatus) || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
    page: filters.page,
    limit: filters.limit,
  })

  const { data: branchesData } = useBranches({ limit: 100 })
  const { data: coaOptions } = useCoaOptions()
  const branches = branchesData?.data ?? []
  const pettyCashCoaOptions = coaOptions ?? []

  const createRequest = useCreatePettyCashRequestForm()

  const rows = data?.data ?? []
  const pagination = data?.pagination

  const hasActiveFilters = filters.branch_id || filters.status || filters.date_from || filters.date_to || filters.search

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kas Kecil</h1>
        {canInsert && (
          <button onClick={createRequest.open} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Buat Request
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari no. request..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <select value={filters.branch_id} onChange={(e) => setFilters({ branch_id: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
          <option value="">Semua cabang</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value as any })} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ date_from: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ date_to: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
        {hasActiveFilters && (
          <button onClick={resetFilters} className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Tidak ada data</div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">No. Request</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Cabang</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Dibuat</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">Diajukan</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">Dicairkan</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">Expense</th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const remaining = r.total_disbursed - r.total_expenses
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{r.request_number}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{r.branch_name}</td>
                    <td className="px-3 py-2.5"><PettyCashStatusBadge status={r.status} /></td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtCurrency(r.amount_requested)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtCurrency(r.amount_disbursed)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtCurrency(r.total_expenses)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(remaining > 0 ? remaining : 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination pagination={{ ...pagination, page: filters.page }} onPageChange={setPage} />
      )}

      {createRequest.isOpen && (
        <PettyCashCreateModal
          onClose={createRequest.close}
          form={createRequest.form}
          setForm={createRequest.setForm}
          onSubmit={createRequest.handleSubmit}
          isPending={createRequest.isPending}
          branches={branches}
          pettyCashCoaOptions={pettyCashCoaOptions}
        />
      )}
    </div>
  )
}
