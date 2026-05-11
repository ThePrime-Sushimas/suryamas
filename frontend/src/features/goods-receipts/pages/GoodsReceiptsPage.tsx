import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackageCheck, Plus } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useGoodsReceipts, useDeleteGoodsReceipt } from '../api/goodsReceipts.api'
import type { GoodsReceipt } from '../api/goodsReceipts.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function GoodsReceiptsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canInsert = hasPermission('goods_receipts', 'insert')
  const canDelete = hasPermission('goods_receipts', 'delete')

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<GoodsReceipt | null>(null)

  const queryParams = useMemo(() => ({
    page, limit: 25,
    status: statusFilter || undefined,
  }), [page, statusFilter])

  const { data, isLoading } = useGoodsReceipts(queryParams)
  const deleteGR = useDeleteGoodsReceipt()

  const receipts = data?.data ?? []
  const pagination = data?.pagination

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteGR.mutateAsync(deleteTarget.id)
      toast.success('Goods receipt dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PackageCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Penerimaan Barang</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} penerimaan</p>
            </div>
          </div>
          {canInsert && (
            <button onClick={() => navigate('/inventory/goods-receipts/new')}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Terima Barang
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
          <option value="">Semua Status</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. GR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PO</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Invoice</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                ))
              ) : receipts.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Tidak ada penerimaan barang</td></tr>
              ) : receipts.map(gr => (
                <tr key={gr.id} onClick={() => navigate(`/inventory/goods-receipts/${gr.id}`)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{gr.gr_number}</td>
                  <td className="px-4 py-3 text-blue-600 dark:text-blue-400">{gr.po_number}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{gr.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{gr.branch_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(gr.received_date)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(gr.total_invoice_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gr.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {gr.status === 'CONFIRMED' ? 'Confirmed' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {gr.status === 'DRAFT' && canDelete && (
                      <button onClick={() => setDeleteTarget(gr)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Hapus</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={receipts.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Penerimaan Barang" message={`Yakin ingin menghapus "${deleteTarget?.gr_number}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteGR.isPending} />
    </div>
  )
}
