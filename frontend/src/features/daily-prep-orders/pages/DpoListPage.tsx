import { useState } from 'react'
import { format } from 'date-fns'
import { ClipboardList, Plus, Filter, X } from 'lucide-react'
import { useUrlFilters } from '@/lib/urlFilters'
import { Pagination } from '@/components/ui/Pagination'
import { useBranches } from '@/features/branches/api/branches.api'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useDpoList, useDpoDetail } from '../api/dpo.queries'
import { DpoStatusBadge } from '../components/DpoStatusBadge'
import { DpoCancelDialog } from '../components/DpoCancelDialog'
import { DpoDeleteDialog } from '../components/DpoDeleteDialog'
import { DpoGenerateDialog } from '../components/DpoGenerateDialog'
import { DpoDetailPanel } from '../components/DpoDetailPanel'
import { dpoFilterConfig } from '../utils/dpoFilters.url'
import type { DailyPrepOrderWithRelations } from '../types/dpo.types'

export default function DpoListPage() {
  const { filters, setFilters, resetFilters, setPage } = useUrlFilters(dpoFilterConfig)
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('daily_prep_orders', 'insert')
  const canUpdate = hasPermission('daily_prep_orders', 'update')
  const canDelete = hasPermission('daily_prep_orders', 'delete')

  const { data, isLoading } = useDpoList({
    page: filters.page,
    limit: filters.limit,
    branch_id: filters.branch_id || undefined,
    status: filters.status || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  })
  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  // Selected DPO for detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: selectedDpo, isLoading: detailLoading } = useDpoDetail(selectedId ?? '', {
    enabled: !!selectedId,
  })

  // Dialog state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters = filters.status || filters.branch_id || filters.date_from || filters.date_to

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Daily Prep Orders</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
          </button>
          {canInsert && (
            <button
              onClick={() => setGenerateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Generate
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              value={filters.branch_id}
              onChange={(e) => setFilters({ branch_id: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white"
            >
              <option value="">Semua Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as typeof filters.status })}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white"
            >
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ date_from: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white"
              placeholder="Dari"
            />
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ date_to: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-white"
              placeholder="Sampai"
            />
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
              <X className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* ═══ LEFT: List ═══ */}
        <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[380px] xl:w-[420px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              ))
            ) : !data?.data.length ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Tidak ada data DPO
              </div>
            ) : (
              data.data.map((dpo) => (
                <DpoListItem
                  key={dpo.id}
                  dpo={dpo}
                  isSelected={selectedId === dpo.id}
                  onClick={() => setSelectedId(dpo.id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
              <Pagination pagination={data.pagination} onPageChange={setPage} />
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Detail ═══ */}
        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-col flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto`}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              Pilih DPO dari list untuk melihat detail
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : selectedDpo ? (
            <DpoDetailPanel
              dpo={selectedDpo}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onClose={() => setSelectedId(null)}
              onCancel={() => setCancelTarget(selectedDpo.id)}
              onDelete={() => setDeleteTarget(selectedDpo.id)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              DPO tidak ditemukan
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {cancelTarget && (
        <DpoCancelDialog
          dpoId={cancelTarget}
          open={true}
          onOpenChange={(open) => { if (!open) setCancelTarget(null) }}
        />
      )}
      {deleteTarget && (
        <DpoDeleteDialog
          dpoId={deleteTarget}
          open={true}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
          onSuccess={() => { setDeleteTarget(null); setSelectedId(null) }}
        />
      )}
      <DpoGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={(id) => setSelectedId(id)}
      />
    </div>
  )
}

// ── List Item ─────────────────────────────────────────────────────────────────

function DpoListItem({
  dpo,
  isSelected,
  onClick,
}: {
  dpo: DailyPrepOrderWithRelations
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{dpo.dpo_number}</span>
        <DpoStatusBadge status={dpo.status} />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{dpo.branch_name}</span>
        <span>·</span>
        <span>{format(new Date(dpo.prep_date), 'dd MMM yyyy')}</span>
        <span>·</span>
        <span>{dpo.line_count} items</span>
      </div>
    </div>
  )
}
