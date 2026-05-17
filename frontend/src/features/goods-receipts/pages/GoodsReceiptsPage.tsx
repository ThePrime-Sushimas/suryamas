import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackageCheck, Plus, Search, Filter, Scale } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useGoodsReceipts, useDeleteGoodsReceipt } from '../api/goodsReceipts.api'
import type { GoodsReceipt } from '../api/goodsReceipts.api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function GoodsReceiptsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canInsert = hasPermission('goods_receipts', 'insert')
  const canDelete = hasPermission('goods_receipts', 'delete')

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<GoodsReceipt | null>(null)

  const queryParams = useMemo(() => ({
    page, limit: 25,
    status: statusFilter || undefined,
    search: searchQuery || undefined,
  }), [page, statusFilter, searchQuery])

  const { data, isLoading } = useGoodsReceipts(queryParams)
  const deleteGR = useDeleteGoodsReceipt()

  const receipts = data?.data ?? []
  const pagination = data?.pagination

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteGR.mutateAsync(deleteTarget.id)
      toast.success('Penerimaan barang berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) }
    finally { setDeleteTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
              <PackageCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Penerimaan Barang</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Kelola dan pantau penerimaan barang dari Purchase Order</p>
            </div>
          </div>
          {canInsert && (
            <button onClick={() => navigate('/inventory/goods-receipts/new')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-teal-600/20">
              <Plus className="w-4 h-4" /> <span>Terima Barang Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar Section */}
      <div className="px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/60 backdrop-blur-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cari No. GR, PO, atau Supplier..." 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all appearance-none shadow-sm">
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden flex flex-col h-full">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">No. GR</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Referensi PO</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier & Lokasi</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hasil Timbang</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PIC</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-6 py-5"><div className="h-5 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" /></td></tr>
                  ))
                ) : receipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <PackageCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">Tidak Ada Data</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada penerimaan barang yang sesuai dengan kriteria pencarian.</p>
                    </td>
                  </tr>
                ) : receipts.map(gr => (
                  <tr key={gr.id} onClick={() => navigate(`/inventory/goods-receipts/${gr.id}`)}
                    className="hover:bg-teal-50/30 dark:hover:bg-teal-900/10 cursor-pointer transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400 group-hover:underline">{gr.gr_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-gray-600 dark:text-gray-300">{gr.po_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{gr.supplier_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{gr.branch_name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {fmtDate(gr.received_date)}
                    </td>
                    <td className="px-6 py-4 max-w-[220px]">
                      {(gr.weighing_line_count ?? 0) > 0 && gr.weighing_summary ? (
                        <div className="flex items-start gap-1.5 text-xs text-teal-800 dark:text-teal-300">
                          <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2" title={gr.weighing_summary}>
                            {gr.weighing_summary}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{gr.created_by_name ?? '—'}</div>
                      {gr.status === 'CONFIRMED' && gr.confirmed_by_name && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-0.5 font-medium">✓ {gr.confirmed_by_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold border ${gr.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50'}`}>
                        {gr.status === 'CONFIRMED' ? 'Confirmed' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      {gr.status === 'DRAFT' && canDelete && (
                        <button onClick={() => setDeleteTarget(gr)} className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="lg:hidden flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : receipts.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <PackageCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada data penerimaan barang</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {receipts.map(gr => (
                  <div key={gr.id} onClick={() => navigate(`/inventory/goods-receipts/${gr.id}`)}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400 truncate mb-0.5">{gr.gr_number}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{gr.supplier_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{gr.branch_name}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${gr.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50'}`}>
                        {gr.status === 'CONFIRMED' ? 'Confirmed' : 'Draft'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg mb-2">
                      <span className="font-mono">{gr.po_number}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                      <span>{fmtDate(gr.received_date)}</span>
                    </div>
                    {(gr.weighing_line_count ?? 0) > 0 && gr.weighing_summary && (
                      <div className="flex items-start gap-1.5 text-xs text-teal-800 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-900/20 p-2 rounded-lg mb-3">
                        <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{gr.weighing_summary}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-gray-500 dark:text-gray-400">PIC: </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{gr.created_by_name ?? '—'}</span>
                      </div>
                      {gr.status === 'DRAFT' && canDelete && (
                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(gr) }}
                          className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 p-2 -mr-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 p-4">
              <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={receipts.length} loading={isLoading} />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Penerimaan Barang" message={`Apakah Anda yakin ingin menghapus penerimaan barang "${deleteTarget?.gr_number}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus" variant="danger" isLoading={deleteGR.isPending} />
    </div>
  )
}
