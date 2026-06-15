import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2, Search, X } from 'lucide-react'
import { usePositions } from '@/features/settings/api/settings.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { WasteRecord, WasteSource } from '../api/wasteReport.api'
import { exportWasteDetailExcel } from '../utils/wasteReportExport'
import { EmptyState } from './EmptyState'
import { ModuleBreakdownBar, ProductionOrderStatusBadge } from './ModuleBreakdownBar'
import { SortableTh, type DetailSortColumn, type SortDirection } from './SortableTh'
import { fmt, fmtRp, fmtDate, SOURCE_LABELS, SOURCE_COLORS, DETAIL_PAGE_SIZE } from './wasteReport.constants'

function recordKey(r: WasteRecord): string {
  if (r.source === 'PRODUCTION_ORDER') {
    return `${r.source}-${String(r.metadata?.material_id ?? r.reference_id)}`
  }
  return `${r.source}-${r.reference_id}`
}

function recordPositionId(r: WasteRecord): string | undefined {
  const id = r.metadata?.position_id
  return typeof id === 'string' ? id : undefined
}

function DetailFilters({
  branchFilter,
  positionFilter,
  onBranchChange,
  onPositionChange,
  branches,
  positions,
}: {
  branchFilter: string
  positionFilter: string
  onBranchChange: (v: string) => void
  onPositionChange: (v: string) => void
  branches: { id: string; branch_name: string }[]
  positions: { id: string; position_name: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Cabang
        </label>
        <select
          value={branchFilter}
          onChange={(e) => onBranchChange(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]"
        >
          <option value="">Semua cabang</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.branch_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Position
        </label>
        <select
          value={positionFilter}
          onChange={(e) => onPositionChange(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]"
        >
          <option value="">Semua position</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.position_name}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-400 mt-1">Hanya berlaku untuk Opname Harian</p>
      </div>
      {(branchFilter || positionFilter) && (
        <button
          type="button"
          onClick={() => {
            onBranchChange('')
            onPositionChange('')
          }}
          className="px-3 py-2.5 text-xs font-medium rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Reset filter
        </button>
      )}
    </div>
  )
}

interface DetailTabProps {
  records: WasteRecord[]
  search: string
  onSearchChange: (v: string) => void
  branchNameById: Map<string, string>
  branches: { id: string; branch_name: string }[]
  startDate: string
  endDate: string
}

export function DetailTab({
  records,
  search,
  onSearchChange,
  branchNameById,
  branches,
  startDate,
  endDate,
}: DetailTabProps) {
  const [sortColumn, setSortColumn] = useState<DetailSortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [branchFilter, setBranchFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const toast = useToast()

  const { data: positions = [] } = usePositions()

  const scopedRecords = useMemo(() => {
    return records.filter((r) => {
      if (branchFilter && r.branch_id !== branchFilter) return false
      if (positionFilter) {
        if (r.source !== 'DAILY_OPNAME') return false
        if (recordPositionId(r) !== positionFilter) return false
      }
      return true
    })
  }, [records, branchFilter, positionFilter])

  useEffect(() => {
    setPage(1)
  }, [scopedRecords, sortColumn, sortDirection])

  const handleSort = (column: DetailSortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column)
      setSortDirection('asc')
      return
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }
    setSortColumn(null)
    setSortDirection('desc')
  }

  const sortedRecords = useMemo(() => {
    const base = [...scopedRecords]
    if (!sortColumn) {
      return base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    const dir = sortDirection === 'asc' ? 1 : -1
    const branchOf = (r: WasteRecord) => r.branch_name ?? branchNameById.get(r.branch_id) ?? ''
    return base.sort((a, b) => {
      switch (sortColumn) {
        case 'date':
          return dir * (new Date(a.date).getTime() - new Date(b.date).getTime())
        case 'branch':
          return dir * branchOf(a).localeCompare(branchOf(b), 'id')
        case 'source':
          return dir * SOURCE_LABELS[a.source].localeCompare(SOURCE_LABELS[b.source], 'id')
        case 'product':
          return dir * (a.item_name ?? a.item_id).localeCompare(b.item_name ?? b.item_id, 'id')
        case 'qty':
          return dir * (a.qty - b.qty)
        case 'value':
          return dir * (a.total_cost - b.total_cost)
        case 'reason':
          return dir * (a.reason ?? '').localeCompare(b.reason ?? '', 'id')
        default:
          return 0
      }
    })
  }, [scopedRecords, sortColumn, sortDirection, branchNameById])

  const handleExport = () => {
    setIsExporting(true)
    try {
      exportWasteDetailExcel(sortedRecords, { startDate, endDate, branchNameById })
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message === 'NO_DATA'
          ? 'Tidak ada data untuk diekspor'
          : parseApiError(err, 'Gagal mengekspor detail transaksi')
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / DETAIL_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * DETAIL_PAGE_SIZE
  const pageRecords = sortedRecords.slice(pageStart, pageStart + DETAIL_PAGE_SIZE)

  if (records.length === 0) {
    return <EmptyState message="Tidak ada transaksi waste pada periode ini." />
  }

  if (scopedRecords.length === 0) {
    return (
      <div className="space-y-4">
        <DetailFilters
          branchFilter={branchFilter}
          positionFilter={positionFilter}
          onBranchChange={setBranchFilter}
          onPositionChange={setPositionFilter}
          branches={branches}
          positions={positions}
        />
        <EmptyState message="Tidak ada transaksi yang cocok dengan filter cabang / position." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DetailFilters
        branchFilter={branchFilter}
        positionFilter={positionFilter}
        onBranchChange={setBranchFilter}
        onPositionChange={setPositionFilter}
        branches={branches}
        positions={positions}
      />
      <ModuleBreakdownBar records={scopedRecords} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari produk, cabang, nomor dokumen, alasan..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || sortedRecords.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isExporting ? 'Mengekspor...' : 'Export Excel'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <SortableTh label="Tanggal" column="date" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Cabang" column="branch" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Modul" column="source" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Produk" column="product" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Qty" column="qty" active={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableTh label="Nilai" column="value" active={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableTh label="Alasan" column="reason" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <th className="px-4 py-3">Referensi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {pageRecords.map((r) => (
              <tr key={recordKey(r)} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {fmtDate(r.date)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-60">
                  {r.branch_name ?? branchNameById.get(r.branch_id) ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${SOURCE_COLORS[r.source]}`}>
                    {SOURCE_LABELS[r.source]}
                  </span>
                  <ProductionOrderStatusBadge record={r} />
                  {r.metadata?.cost_unavailable === true && (
                    <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">no cost</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                  {r.item_name ?? r.item_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.qty)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtRp(r.total_cost)}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-60">
                  {r.reason ?? '-'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs truncate">
                  {r.reference_code ?? r.reference_id.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedRecords.length > DETAIL_PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan {pageStart + 1}–{Math.min(pageStart + DETAIL_PAGE_SIZE, sortedRecords.length)} dari{' '}
            {sortedRecords.length} transaksi
          </p>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-gray-600 dark:text-gray-300 px-2">
              Halaman {safePage} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
