import { Plus, Search, X, Loader2 } from 'lucide-react'
import { Button, Input, Select, DateInput } from '@/components/ui'
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

  const hasActiveFilters =
    filters.branch_id || filters.status || filters.date_from || filters.date_to || filters.search

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kas Kecil</h1>
        {canInsert && (
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={createRequest.open}>
            Buat Request
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari no. request..."
            leftIcon={<Search className="h-4 w-4" />}
            className={searchInput ? 'pr-9' : undefined}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Hapus pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={filters.branch_id}
          onChange={(e) => setFilters({ branch_id: e.target.value })}
          className="min-w-[160px]"
        >
          <option value="">Semua cabang</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.branch_name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={(e) =>
            setFilters({ status: e.target.value as '' | PettyCashRequestStatus })
          }
          className="min-w-[140px]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <DateInput
          value={filters.date_from}
          onChange={(e) => setFilters({ date_from: e.target.value })}
          className="w-auto"
          aria-label="Tanggal dari"
        />

        <DateInput
          value={filters.date_to}
          onChange={(e) => setFilters({ date_to: e.target.value })}
          className="w-auto"
          aria-label="Tanggal sampai"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Tidak ada data</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-700/30">
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">
                  No. Request
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">
                  Cabang
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300">
                  Tgl Dibuat
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">
                  Diajukan
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">
                  Dicairkan
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">
                  Expense
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300">
                  Sisa
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const remaining = r.total_disbursed - r.total_expenses
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className="cursor-pointer border-b border-gray-50 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                      {r.request_number}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{r.branch_name}</td>
                    <td className="px-3 py-2.5">
                      <PettyCashStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {fmtCurrency(r.amount_requested)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {fmtCurrency(r.amount_disbursed)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {fmtCurrency(r.total_expenses)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                      {fmtCurrency(remaining > 0 ? remaining : 0)}
                    </td>
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
