import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Search, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { usePurchaseRequests, useDeletePurchaseRequest, useCancelPurchaseRequest } from '../api/purchaseRequests.api'
import type { PurchaseRequest } from '../api/purchaseRequests.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  APPROVED: { label: 'Disetujui', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  CONVERTED: { label: 'Dikonversi ke PO', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
}

export default function PurchaseRequestsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canInsert = hasPermission('purchase_requests', 'insert')
  const canDelete = hasPermission('purchase_requests', 'delete')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [cancelTarget, setCancelTarget] = useState<PurchaseRequest | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequest | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const queryParams = useMemo(() => ({
    page, limit: 25,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  }), [page, debouncedSearch, statusFilter])

  const { data, isLoading } = usePurchaseRequests(queryParams)
  const deletePR = useDeletePurchaseRequest()
  const cancelPR = useCancelPurchaseRequest()

  const requests = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePR.mutateAsync(deleteTarget.id)
      toast.success('Purchase request dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) }
    finally { setDeleteTarget(null) }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    try {
      await cancelPR.mutateAsync(cancelTarget.id)
      toast.success('Purchase request dibatalkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membatalkan')) }
    finally { setCancelTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Purchase Request</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} permintaan</p>
            </div>
          </div>
          {canInsert && (
            <button onClick={() => navigate('/inventory/purchase-requests/new')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              <Plus className="w-4 h-4" /> Buat Permintaan
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari nomor PR atau cabang..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="">Semua Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. PR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dibutuhkan</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Est. Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Oleh</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                ))
              ) : requests.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">Tidak ada purchase request</td></tr>
              ) : requests.map(pr => {
                const statusCfg = STATUS_CONFIG[pr.status] ?? STATUS_CONFIG.DRAFT
                return (
                  <tr key={pr.id} onClick={() => navigate(`/inventory/purchase-requests/${pr.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{pr.request_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.branch_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(pr.request_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.needed_by_date ? fmtDate(pr.needed_by_date) : '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{pr.line_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                      {pr.total_estimated > 0 ? `Rp ${fmt(pr.total_estimated)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{pr.requested_by_name || '—'}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {['DRAFT', 'PENDING_APPROVAL'].includes(pr.status) && (
                          <button onClick={() => setCancelTarget(pr)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Batal</button>
                        )}
                        {['DRAFT', 'REJECTED', 'CANCELLED'].includes(pr.status) && canDelete && (
                          <button onClick={() => setDeleteTarget(pr)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Hapus</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={requests.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Purchase Request" message={`Yakin ingin menghapus "${deleteTarget?.request_number}"?`}
        confirmText="Hapus" variant="danger" isLoading={deletePR.isPending} />

      <ConfirmModal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={handleCancel}
        title="Batalkan Purchase Request" message={`Yakin ingin membatalkan "${cancelTarget?.request_number}"?`}
        confirmText="Batalkan" variant="danger" isLoading={cancelPR.isPending} />
    </div>
  )
}
