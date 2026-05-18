import { useState } from 'react'
import { useListNavigation } from '@/lib/urlFilters'
import { ShoppingCart, Search, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import { PO_LIST_TABS, PO_STATUS_CONFIG } from '../constants'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { usePurchaseOrders, useDeletePurchaseOrder } from '../api/purchaseOrders.api'
import type { PurchaseOrder } from '../api/purchaseOrders.api'
import { usePurchaseOrderFilters } from '../hooks/usePurchaseOrderFilters'
const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const PURCHASE_ORDERS_LIST_PATH = '/inventory/purchase-orders'

export default function PurchaseOrdersPage() {
  const { openDetail } = useListNavigation(PURCHASE_ORDERS_LIST_PATH)
  const toast = useToast()
  const hasPermission = usePermissionStore((state) => state.hasPermission)
  const canDelete = hasPermission('purchase_orders', 'delete')

  const {
    filters,
    searchInput,
    setSearchInput,
    apiQuery,
    setFilters,
    setPage,
    setLimit,
  } = usePurchaseOrderFilters()

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const suppliers = suppliersData?.data ?? []

  const { data, isLoading } = usePurchaseOrders(apiQuery)
  const deletePO = useDeletePurchaseOrder()

  const orders = data?.data ?? []
  const pagination = data?.pagination

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePO.mutateAsync(deleteTarget.id)
      toast.success('Purchase order dihapus')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Purchase Order</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} order</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto py-2">
          {PO_LIST_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilters({ tab: tab.id, status: '' })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filters.tab === tab.id && !filters.status
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor PO atau supplier..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setFilters({ search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value, tab: 'all' })}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Semua Status</option>
            {Object.entries(PO_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <select
            value={filters.supplierId}
            onChange={(e) => setFilters({ supplierId: e.target.value })}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-w-[180px]"
          >
            <option value="">Semua Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. PO</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal PO</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pembayaran</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      Tidak ada purchase order
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => {
                    const statusCfg = PO_STATUS_CONFIG[po.status] ?? PO_STATUS_CONFIG.DRAFT
                    return (
                      <tr
                        key={po.id}
                        onClick={() => openDetail(`${PURCHASE_ORDERS_LIST_PATH}/${po.id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">{po.po_number}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{po.supplier_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{po.branch_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(po.order_date)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              po.payment_type === 'CASH'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                            }`}
                          >
                            {po.payment_type === 'CASH' ? 'Cash' : `Tempo ${po.payment_terms_days ?? ''}hr`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                          Rp {fmt(po.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {po.status === 'DRAFT' && canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(po)}
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                            >
                              Hapus
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada purchase order</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {orders.map((po) => {
                  const statusCfg = PO_STATUS_CONFIG[po.status] ?? PO_STATUS_CONFIG.DRAFT
                  return (
                    <div
                      key={po.id}
                      onClick={() => openDetail(po.id)}
                      className="p-4 space-y-2 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-medium text-gray-900 dark:text-white text-sm">{po.po_number}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {po.supplier_name} · {po.branch_name}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex gap-3">
                          <span className="text-gray-500">{fmtDate(po.order_date)}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              po.payment_type === 'CASH'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                            }`}
                          >
                            {po.payment_type === 'CASH' ? 'Cash' : 'Tempo'}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">
                          Rp {fmt(po.total_amount)}
                        </span>
                      </div>
                      {po.status === 'DRAFT' && canDelete && (
                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(po)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            onLimitChange={setLimit}
            currentLength={orders.length}
            loading={isLoading}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Purchase Order"
        message={`Yakin ingin menghapus "${deleteTarget?.po_number}"?`}
        confirmText="Hapus"
        variant="danger"
        isLoading={deletePO.isPending}
      />
    </div>
  )
}
