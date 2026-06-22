import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, RotateCcw, ExternalLink, MessageSquare, Check, X, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { PR_STATUS_CONFIG, PR_PRIORITY_CONFIG } from '../constants'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { Pagination } from '@/components/ui/Pagination'
import {
  usePendingReopenRequestsList,
  useApproveMonthlyOpnameReopenRequest,
  useRejectMonthlyOpnameReopenRequest,
} from '@/features/monthly-stock-opname/api/monthlyStockOpname'
import type { MonthlyOpnameReopenRequestWithRelations } from '@/features/monthly-stock-opname/types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (d: string) => new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const PR_TABS = [
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'CONVERTED', label: 'Converted' },
  { key: 'REJECTED', label: 'Rejected' },
]

const SO_TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
]

export default function PRApprovalListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const branches = useBranchContextStore(state => state.branches)

  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canApprovePR = hasPermission('purchase_requests', 'approve')
  const canApproveSO = hasPermission('monthly_stock_opname', 'approve')

  const [activeTab, setActiveTab] = useState('PENDING_APPROVAL')
  const [activeSOTab, setActiveSOTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')

  const [module, setModule] = useState<'pr' | 'stock-opname'>(() => {
    if (canApprovePR) return 'pr'
    if (canApproveSO) return 'stock-opname'
    return 'pr'
  })

  // ─── PR SEARCH & FILTER STATE ──────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [page, setPage] = useState(1)
  const LIMIT = 25

  const debouncedSearch = useDebounce(search, 400)

  const prQueryParams = useMemo(() => ({
    status: activeTab,
    limit: LIMIT,
    page,
    search: debouncedSearch || undefined,
    branch_id: branchFilter || undefined,
  }), [activeTab, page, debouncedSearch, branchFilter])

  // ─── PURCHASE REQUEST QUERY ───────────────────────────────────────────────
  const { data: prData, isLoading: isPRLoading } = useQuery({
    queryKey: ['purchase-requests', 'approval-list', prQueryParams],
    queryFn: async () => {
      const params: Record<string, unknown> = { status: prQueryParams.status, limit: prQueryParams.limit, page: prQueryParams.page }
      if (prQueryParams.search) params.q = prQueryParams.search
      if (prQueryParams.branch_id) params.branch_id = prQueryParams.branch_id
      const { data } = await api.get('/purchase-requests', { params })
      return { data: data.data as Record<string, any>[], pagination: data.pagination }
    },
    enabled: module === 'pr' && canApprovePR,
  })

  const prList = prData?.data ?? []
  const prPagination = prData?.pagination

  // ─── STOCK OPNAME REOPEN QUERY ────────────────────────────────────────────
  const { data: soData, isLoading: isSOLoading } = usePendingReopenRequestsList(
    module === 'stock-opname' ? activeSOTab : undefined,
    { enabled: module === 'stock-opname' && canApproveSO },
  )

  const approveReopen = useApproveMonthlyOpnameReopenRequest()
  const rejectReopen = useRejectMonthlyOpnameReopenRequest()

  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject'
    request: MonthlyOpnameReopenRequestWithRelations
  } | null>(null)
  const [responseNote, setResponseNote] = useState('')

  const handleActionSubmit = async () => {
    if (!actionModal) return
    const { type, request } = actionModal

    try {
      if (type === 'approve') {
        await approveReopen.mutateAsync({
          requestId: request.id,
          sessionId: request.opname_id,
          body: { response_note: responseNote },
        })
        toast.success('Permintaan reopen berhasil di-approve')
      } else {
        await rejectReopen.mutateAsync({
          requestId: request.id,
          sessionId: request.opname_id,
          body: { response_note: responseNote },
        })
        toast.success('Permintaan reopen berhasil ditolak')
      }
      setActionModal(null)
      setResponseNote('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memproses aksi reopen')
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setPage(1)
  }

  const isPageLoading = module === 'pr' ? isPRLoading : isSOLoading

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Pusat Approval</h1>              
            </div>
          </div>

          {/* Module Switcher (Only display switcher if user has permission for both modules) */}
          {canApprovePR && canApproveSO && (
            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg self-start sm:self-auto">
              <button
                onClick={() => setModule('pr')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  module === 'pr'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Purchase Request
              </button>
              <button
                onClick={() => setModule('stock-opname')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                  module === 'stock-opname'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Reopen SO Bulanan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6">
        <div className="flex gap-1">
          {module === 'pr' && PR_TABS.map(tab => (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}

          {module === 'stock-opname' && SO_TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveSOTab(tab.key as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeSOTab === tab.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filter (PR only) */}
      {module === 'pr' && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari No. Permintaan Pembelian..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={branchFilter}
              onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-w-[180px]"
            >
              <option value="">Semua Cabang</option>
              {branches.map((b: { branch_id: string; branch_name: string }) => (
                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isPageLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
          </div>
        ) : module === 'pr' ? (
          // ─── PURCHASE REQUEST DASHBOARD ──────────────────────────────────────────
          (prList.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {activeTab === 'PENDING_APPROVAL' ? 'Tidak ada PR yang menunggu approval' :
                 activeTab === 'CONVERTED' ? 'Belum ada PR yang di-convert' :
                 'Belum ada PR yang ditolak'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="sm:hidden space-y-3">
                {prList.map((pr: Record<string, any>) => {
                  const status = PR_STATUS_CONFIG[pr.status] ?? PR_STATUS_CONFIG.PENDING_APPROVAL
                  const priority = PR_PRIORITY_CONFIG[pr.priority] ?? PR_PRIORITY_CONFIG.normal
                  return (
                    <Link key={pr.id} to={`/inventory/purchase-requests/${pr.id}/approve`} className="block bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 border border-transparent transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{pr.request_number}</p>
                          <p className="text-xs text-gray-500">{pr.branch_name}</p>
                        </div>
                        <div className="flex gap-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>{priority.label}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Tanggal</span>
                          <p className="text-gray-900 dark:text-gray-200">{fmtDate(pr.request_date)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Dibutuhkan</span>
                          <p className="text-gray-900 dark:text-gray-200">{pr.needed_by_date ? fmtDate(pr.needed_by_date) : '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Estimasi</span>
                          <p className="font-mono text-gray-900 dark:text-gray-200">
                            {pr.total_pricelist > 0 ? `Rp ${fmt(pr.total_pricelist)}` : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Dibuat oleh</span>
                          <p className="text-gray-900 dark:text-gray-200">{pr.requested_by_name || '—'}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Desktop: Table */}
              <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Permintaan Pembelian</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prioritas</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estimasi</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dibuat oleh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {prList.map((pr: Record<string, any>) => {
                        const status = PR_STATUS_CONFIG[pr.status] ?? PR_STATUS_CONFIG.PENDING_APPROVAL
                        const priority = PR_PRIORITY_CONFIG[pr.priority] ?? PR_PRIORITY_CONFIG.normal
                        return (
                          <tr key={pr.id} onClick={() => navigate(`/inventory/purchase-requests/${pr.id}/approve`)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              <Link to={`/inventory/purchase-requests/${pr.id}/approve`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline" onClick={e => e.stopPropagation()}>
                                {pr.request_number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.branch_name}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(pr.request_date)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>{priority.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                              {pr.total_pricelist > 0 ? `Rp ${fmt(pr.total_pricelist)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.requested_by_name || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {prPagination && prPagination.total > 0 && (
                <Pagination
                  pagination={prPagination}
                  onPageChange={setPage}
                  onLimitChange={() => {}}
                  currentLength={prList.length}
                  loading={isPRLoading}
                />
              )}
            </>
          ))
        ) : (
          // ─── STOCK OPNAME REOPEN DASHBOARD ────────────────────────────────────────
          (!soData || soData.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {activeSOTab === 'PENDING' ? 'Tidak ada permintaan reopen SO bulanan yang menunggu approval' :
                 activeSOTab === 'APPROVED' ? 'Belum ada permintaan reopen yang disetujui' :
                 'Belum ada permintaan reopen yang ditolak'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="sm:hidden space-y-3">
                {soData.map((req) => (
                  <div key={req.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{req.opname_number}</span>
                          <Link to={`/inventory/monthly-stock-opname/${req.opname_id}`} className="text-gray-400 hover:text-indigo-600">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        <p className="text-xs text-gray-500">{req.branch_name}</p>
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                          req.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tanggal SO:</span>
                        <span className="text-gray-900 dark:text-gray-200">{fmtDate(req.opname_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Diajukan:</span>
                        <span className="text-gray-900 dark:text-gray-200">{fmtDateTime(req.requested_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Oleh:</span>
                        <span className="text-gray-900 dark:text-gray-200">{req.requested_by_name}</span>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-gray-700 dark:text-gray-300 mt-1">
                        <p className="font-semibold text-[10px] uppercase text-gray-400">Alasan:</p>
                        <p className="mt-0.5">{req.reason}</p>
                      </div>

                      {req.status !== 'PENDING' && (
                        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-2 rounded text-gray-700 dark:text-gray-300 mt-1 border border-indigo-100/30">
                          <p className="font-semibold text-[10px] uppercase text-indigo-500">Respon:</p>
                          <p className="mt-0.5">Oleh: {req.responded_by_name || '—'}</p>
                          {req.response_note && <p className="mt-1 italic">"{req.response_note}"</p>}
                        </div>
                      )}
                    </div>

                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => setActionModal({ type: 'reject', request: req })}
                          className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:bg-transparent dark:hover:bg-red-900/10"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'approve', request: req })}
                          className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. SO</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal SO</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Diajukan</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alasan Reopen</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        {activeSOTab !== 'PENDING' && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Respon/Catatan</th>
                        )}
                        {activeSOTab === 'PENDING' && (
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {soData.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/10">
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-900 dark:text-white font-semibold">{req.opname_number}</span>
                              <Link to={`/inventory/monthly-stock-opname/${req.opname_id}`} className="text-gray-400 hover:text-indigo-600" title="Buka Detail Stock Opname">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{req.branch_name}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(req.opname_date)}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-900 dark:text-gray-200 font-medium">{req.requested_by_name}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(req.requested_at)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block ${
                              req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                              req.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                              'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          {activeSOTab !== 'PENDING' && (
                            <td className="px-4 py-3">
                              <div className="text-xs text-gray-900 dark:text-gray-200">
                                <span className="font-semibold">Oleh:</span> {req.responded_by_name || '—'}
                              </div>
                              {req.response_note && (
                                <div className="text-[11px] text-gray-500 italic mt-0.5 max-w-[180px] truncate" title={req.response_note}>
                                  "{req.response_note}"
                                </div>
                              )}
                            </td>
                          )}
                          {activeSOTab === 'PENDING' && (
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex gap-2">
                                <button
                                  onClick={() => setActionModal({ type: 'reject', request: req })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:bg-transparent dark:hover:bg-red-900/10"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                                <button
                                  onClick={() => setActionModal({ type: 'approve', request: req })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ))
        )}
      </div>

      {/* Action Dialog Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 border dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {actionModal.type === 'approve' ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  Approve Reopen Request
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-600" />
                  Reject Reopen Request
                </>
              )}
            </h3>

            {/* Request Summary info */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs space-y-1 text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>No. SO:</span>
                <span className="font-semibold text-gray-950 dark:text-white">{actionModal.request.opname_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Cabang:</span>
                <span>{actionModal.request.branch_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Diajukan Oleh:</span>
                <span>{actionModal.request.requested_by_name}</span>
              </div>
              <div className="pt-2 mt-2 border-t dark:border-gray-600 text-gray-800 dark:text-gray-200">
                <span className="font-semibold text-[10px] text-gray-400 block uppercase mb-1">Alasan Reopen:</span>
                "{actionModal.request.reason}"
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Catatan Evaluasi {actionModal.type === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                rows={3}
                className="w-full text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-900 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400"
                placeholder={actionModal.type === 'approve' ? 'Tulis catatan persetujuan (opsional)...' : 'Wajib menulis alasan penolakan...'}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setActionModal(null)
                  setResponseNote('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Batal
              </button>
              <button
                onClick={handleActionSubmit}
                disabled={
                  (actionModal.type === 'reject' && !responseNote.trim()) ||
                  approveReopen.isPending ||
                  rejectReopen.isPending
                }
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  actionModal.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 disabled:opacity-50'
                    : 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                }`}
              >
                {approveReopen.isPending || rejectReopen.isPending
                  ? 'Memproses...'
                  : actionModal.type === 'approve'
                  ? 'Konfirmasi Approve'
                  : 'Konfirmasi Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}