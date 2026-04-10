import { useState, useEffect, useCallback } from 'react'
import { posStagingApi } from '../api/pos-staging.api'
import { branchesApi } from '@/features/branches/api/branches.api'
import { paymentMethodsApi } from '@/features/payment-methods/api/paymentMethods.api'
import { usePermission } from '@/features/branch_context/hooks/usePermission'
import { AlertCircle } from 'lucide-react'
import type {
  StagingTable,
  StagingStatus,
  StagingRow,
  StagingBranch,
  StagingPaymentMethod,
  StagingMenuCategory,
  StagingMenuGroup,
  StagingMenu,
} from '../types/pos-staging.types'
import type { Branch } from '@/features/branches/types'
import type { PaymentMethodOption } from '@/features/payment-methods/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const TABLES: { key: StagingTable; label: string }[] = [
  { key: 'branches',        label: 'Branches' },
  { key: 'payment_methods', label: 'Payment Methods' },
  { key: 'menu_categories', label: 'Menu Categories' },
  { key: 'menu_groups',     label: 'Menu Groups' },
  { key: 'menus',           label: 'Menus' },
]

const STATUS_OPTIONS: { value: StagingStatus | ''; label: string }[] = [
  { value: '',         label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'ignored',  label: 'Ignored' },
]

const STATUS_BADGE: Record<StagingStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  ignored:  'bg-gray-100 text-gray-500',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRowName(table: StagingTable, row: StagingRow): string {
  switch (table) {
    case 'branches':        return (row as StagingBranch).branch_name
    case 'payment_methods': return (row as StagingPaymentMethod).name
    case 'menu_categories': return (row as StagingMenuCategory).category_name
    case 'menu_groups':     return (row as StagingMenuGroup).group_name
    case 'menus':           return (row as StagingMenu).menu_name
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PosStagingPage() {
  const { hasPermission, isLoaded } = usePermission('pos_imports', 'view')
  
  const [activeTable, setActiveTable] = useState<StagingTable>('branches')
  const [statusFilter, setStatusFilter] = useState<StagingStatus | ''>('pending')
  const [rows, setRows] = useState<StagingRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  // For branches mapping dropdown
  const [branches, setBranches] = useState<Branch[]>([])
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([])
  const [mappingId, setMappingId] = useState<Record<number, string>>({})

  const LIMIT = 50

  // ── Fetch staging rows ──────────────────────────────────────────────────
  const fetchRows = useCallback(async () => {
    if (!hasPermission) return
    setLoading(true)
    try {
      const res = await posStagingApi.list(activeTable, {
        status: statusFilter || undefined,
        page,
        limit: LIMIT,
      })
      setRows(res.data)
      setTotal(res.total)
    } catch (err) {
      console.error('Failed to fetch staging rows', err)
    } finally {
      setLoading(false)
    }
  }, [activeTable, statusFilter, page, hasPermission])

  useEffect(() => {
    if (isLoaded && hasPermission) {
      fetchRows()
    }
  }, [fetchRows, isLoaded, hasPermission])

  // Reset page and mappingId on tab/filter change
  useEffect(() => {
    setPage(1)
    setMappingId({})
  }, [activeTable, statusFilter])

  // ── Fetch branches for mapping dropdown ────────────────────────────────
  useEffect(() => {
    if (!hasPermission || activeTable !== 'branches') return
    branchesApi.list(1, 200).then(res => setBranches(res.data)).catch(console.error)
  }, [activeTable, hasPermission])

  // ── Fetch payment methods for mapping dropdown ──────────────────────────
  useEffect(() => {
    if (!hasPermission || activeTable !== 'payment_methods') return
    paymentMethodsApi.getOptions()
      .then(setPaymentMethodOptions)
      .catch(console.error)
  }, [activeTable, hasPermission])

  // ── Actions ────────────────────────────────────────────────────────────
  const handleAction = async (
    posId: number,
    status: StagingStatus,
    extra?: { mapped_id?: string; mapped_product_id?: string },
  ) => {
    setActionLoadingId(posId)
    try {
      await posStagingApi.update(activeTable, posId, { status, ...extra })
      await fetchRows()
    } catch (err) {
      console.error('Failed to update staging row', err)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleApprove = (row: StagingRow) => {
    const posId = row.pos_id
    const extra: Record<string, string> = {}

    if (activeTable === 'branches' || activeTable === 'payment_methods') {
      const mid = mappingId[posId]
      if (!mid) {
        alert('Pilih mapping terlebih dahulu sebelum approve.')
        return
      }
      extra.mapped_id = mid
    }

    handleAction(posId, 'approved', extra)
  }

  const handleIgnore = (row: StagingRow) => {
    if (!confirm(`Abaikan "${getRowName(activeTable, row)}"?`)) return
    handleAction(row.pos_id, 'ignored')
  }

  const handleResetToPending = (row: StagingRow) => {
    handleAction(row.pos_id, 'pending')
  }

  if (isLoaded && !hasPermission) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <div>
            <h3 className="font-semibold">Access Denied</h3>
            <p className="text-sm">You do not have permission to view POS staging data.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Columns per table ──────────────────────────────────────────────────
  const renderTableHeader = () => {
    const base = ['POS ID', 'Nama', 'Status', 'Aktif']
    const extra: Record<StagingTable, string[]> = {
      branches:        ['Kode', 'Mapping Branch', 'Aksi'],
      payment_methods: ['Kode', 'COA No', 'Mapping', 'Aksi'],
      menu_categories: ['Sales COA', 'Aksi'],
      menu_groups:     ['Kode', 'Aksi'],
      menus:           ['Kode', 'Harga', 'Sales COA', 'Aksi'],
    }
    return [...base, ...extra[activeTable]].map(h => (
      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
        {h}
      </th>
    ))
  }

  const renderRow = (row: StagingRow) => {
    const posId = row.pos_id
    const name = getRowName(activeTable, row)
    const isLoading = actionLoadingId === posId
    const isPending = row.status === 'pending'

    const baseCells = (
      <>
        <td className="px-3 py-2 text-sm text-gray-500">{posId}</td>
        <td className="px-3 py-2 text-sm font-medium text-gray-900">{name}</td>
        <td className="px-3 py-2">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[row.status]}`}>
            {row.status}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">
          {row.flag_active ? '✅' : '❌'}
        </td>
      </>
    )

    const actionButtons = (
      <td className="px-3 py-2 whitespace-nowrap">
        {isPending ? (
          <div className="flex gap-2">
            <button
              id={`approve-${activeTable}-${posId}`}
              onClick={() => handleApprove(row)}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              id={`ignore-${activeTable}-${posId}`}
              onClick={() => handleIgnore(row)}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
            >
              Ignore
            </button>
          </div>
        ) : (
          <button
            id={`reset-${activeTable}-${posId}`}
            onClick={() => handleResetToPending(row)}
            disabled={isLoading}
            className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </td>
    )

    if (activeTable === 'branches') {
      const r = row as StagingBranch
      return (
        <tr key={posId} className="border-b hover:bg-gray-50">
          {baseCells}
          <td className="px-3 py-2 text-sm text-gray-500">{r.branch_code ?? '—'}</td>
          <td className="px-3 py-2">
            {isPending ? (
              <select
                id={`mapping-${activeTable}-${posId}`}
                value={mappingId[posId] ?? ''}
                onChange={e => setMappingId(prev => ({ ...prev, [posId]: e.target.value }))}
                className="text-sm border rounded px-2 py-1 w-40"
              >
                <option value="">— pilih branch —</option>
                {branches.map(b => (
                  <option key={b.id} value={String(b.id)}>{b.branch_name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-500">{r.mapped_id ?? '—'}</span>
            )}
          </td>
          {actionButtons}
        </tr>
      )
    }

    if (activeTable === 'payment_methods') {
      const r = row as StagingPaymentMethod
      return (
        <tr key={posId} className="border-b hover:bg-gray-50">
          {baseCells}
          <td className="px-3 py-2 text-sm text-gray-500">{r.code ?? '—'}</td>
          <td className="px-3 py-2 text-sm text-gray-500">{r.coa_no ?? '—'}</td>
          <td className="px-3 py-2">
            {isPending ? (
              <select
                id={`mapping-${activeTable}-${posId}`}
                value={mappingId[posId] ?? ''}
                onChange={e => setMappingId(prev => ({ ...prev, [posId]: e.target.value }))}
                className="text-sm border rounded px-2 py-1 w-56"
              >
                <option value="">— pilih payment method —</option>
                {paymentMethodOptions.map(opt => (
                  <option key={opt.id} value={String(opt.id)}>
                    {opt.name}
                    {opt.payment_type !== 'CASH' ? ` (${opt.payment_type}${opt.bank_name ? ` · ${opt.bank_name}` : ''})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-500">{r.mapped_id ?? '—'}</span>
            )}
          </td>
          {actionButtons}
        </tr>
      )
    }

    if (activeTable === 'menu_categories') {
      const r = row as StagingMenuCategory
      return (
        <tr key={posId} className="border-b hover:bg-gray-50">
          {baseCells}
          <td className="px-3 py-2 text-sm text-gray-500">{r.sales_coa_no ?? '—'}</td>
          {actionButtons}
        </tr>
      )
    }

    if (activeTable === 'menu_groups') {
      const r = row as StagingMenuGroup
      return (
        <tr key={posId} className="border-b hover:bg-gray-50">
          {baseCells}
          <td className="px-3 py-2 text-sm text-gray-500">{r.group_code ?? '—'}</td>
          {actionButtons}
        </tr>
      )
    }

    // menus
    const r = row as StagingMenu
    return (
      <tr key={posId} className="border-b hover:bg-gray-50">
        {baseCells}
        <td className="px-3 py-2 text-sm text-gray-500">{r.menu_code ?? '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-500">
          {r.price != null ? `Rp ${r.price.toLocaleString('id-ID')}` : '—'}
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">{r.sales_coa_no ?? '—'}</td>
        {actionButtons}
      </tr>
    )
  }

  const totalPages = Math.ceil(total / LIMIT)

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">POS Staging Data</h1>

      {/* Tab */}
      <div className="flex gap-1 border-b mb-4">
        {TABLES.map(t => (
          <button
            id={`tab-${t.key}`}
            key={t.key}
            onClick={() => setActiveTable(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTable === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Status:</span>
        {STATUS_OPTIONS.map(s => (
          <button
            id={`filter-status-${s.value || 'all'}`}
            key={s.value}
            onClick={() => setStatusFilter(s.value as StagingStatus | '')}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              statusFilter === s.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{total} baris</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>{renderTableHeader()}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={99} className="px-4 py-8 text-center text-sm text-gray-400">
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={99} className="px-4 py-8 text-center text-sm text-gray-400">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              rows.map(row => renderRow(row))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4">
          <button
            id="pagination-prev"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Halaman {page} / {totalPages}
          </span>
          <button
            id="pagination-next"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

