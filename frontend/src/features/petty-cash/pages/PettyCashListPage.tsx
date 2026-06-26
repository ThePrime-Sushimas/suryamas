import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranches } from '@/features/branches/api/branches.api'
import { usePettyCashRequests, useCreatePettyCashRequest } from '../api/pettyCash.api'
import { useCoaOptions } from '@/features/food-production/api/food-production.api'
import { PettyCashStatusBadge } from '../components/PettyCashStatusBadge'
import type { PettyCashRequestStatus } from '../types/pettyCash.types'

const fmtCurrency = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_OPTIONS: Array<{ value: '' | PettyCashRequestStatus; label: string }> = [
  { value: '', label: 'Semua status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DISBURSED', label: 'Aktif' },
  { value: 'CLOSED', label: 'Selesai' },
  { value: 'REJECTED', label: 'Ditolak' },
]

export default function PettyCashListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('petty_cash', 'insert')

  const [filters, setFilters] = useState({ search: '', branchId: '', status: '' as '' | PettyCashRequestStatus, dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(1)

  const { data, isLoading } = usePettyCashRequests({
    branch_id: filters.branchId || undefined,
    status: filters.status || undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    search: filters.search || undefined,
    page,
    limit: 25,
  })

  const { data: branchesData } = useBranches({ limit: 100 })
  const { data: coaOptions } = useCoaOptions()
  const branches = branchesData?.data ?? []
  const pettyCashCoaOptions = coaOptions ?? []

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ branch_id: '', amount_requested: '', petty_cash_coa_id: '', description: '' })
  const createMutation = useCreatePettyCashRequest()

  const handleCreate = async () => {
    if (!createForm.branch_id || !createForm.amount_requested || !createForm.petty_cash_coa_id) {
      toast.error('Cabang, jumlah, dan COA kas kecil wajib diisi')
      return
    }
    try {
      await createMutation.mutateAsync({
        branch_id: createForm.branch_id,
        amount_requested: Number(createForm.amount_requested),
        petty_cash_coa_id: createForm.petty_cash_coa_id,
        description: createForm.description || undefined,
      })
      toast.success('Request berhasil dibuat')
      setShowCreate(false)
      setCreateForm({ branch_id: '', amount_requested: '', petty_cash_coa_id: '', description: '' })
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat request'))
    }
  }

  const rows = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kas Kecil</h1>
        {canInsert && (
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Buat Request
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={filters.search}
            onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
            placeholder="Cari no. request..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
          {filters.search && (
            <button onClick={() => setFilters(f => ({ ...f, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <select value={filters.branchId} onChange={(e) => { setFilters(f => ({ ...f, branchId: e.target.value })); setPage(1) }} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
          <option value="">Semua cabang</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value as any })); setPage(1) }} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1) }} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
        <input type="date" value={filters.dateTo} onChange={(e) => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1) }} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
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
                    onClick={() => navigate(`/finance/petty-cash/${r.id}`)}
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
        <Pagination pagination={{ ...pagination, page }} onPageChange={setPage} />
      )}

      {/* Create Request Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Buat Request Kas Kecil</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cabang *</label>
                <select value={createForm.branch_id} onChange={(e) => setCreateForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">Pilih cabang</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Diajukan *</label>
                <input type="number" value={createForm.amount_requested} onChange={(e) => setCreateForm(f => ({ ...f, amount_requested: e.target.value }))} placeholder="500000" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">COA Kas Kecil *</label>
                <select value={createForm.petty_cash_coa_id} onChange={(e) => setCreateForm(f => ({ ...f, petty_cash_coa_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">Pilih akun</option>
                  {pettyCashCoaOptions.map(c => <option key={c.id} value={c.id}>{c.account_code} — {c.account_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">Batal</button>
              <button onClick={handleCreate} disabled={createMutation.isPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buat Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
