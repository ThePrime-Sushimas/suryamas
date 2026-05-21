import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { Wallet, Search, Plus, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import { useBranches } from '@/features/branches/api/branches.api'
import {
  AP_LIST_TABS,
  AP_PAYMENTS_LIST_PATH,
  AP_PAYMENT_METHOD_LABELS,
  AP_STATUS_CONFIG,
} from '../constants'
import { isApListTabActive } from '../utils/apPaymentFilters.url'
import { useApPayments, useDeleteApPayment, type ApPayment } from '../api/apPayments.api'
import { useApPaymentFilters } from '../hooks/useApPaymentFilters'
import type { ApPaymentStatus } from '../api/apPayments.api'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export default function ApPaymentsPage() {
  const { openDetail } = useListNavigation(AP_PAYMENTS_LIST_PATH)
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('ap_payments', 'insert')
  const canDelete = hasPermission('ap_payments', 'delete')

  const {
    filters,
    searchInput,
    setSearchInput,
    apiQuery,
    setFilters,
    setPage,
    setLimit,
  } = useApPaymentFilters()

  const [deleteTarget, setDeleteTarget] = useState<ApPayment | null>(null)

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const { data: branchesData } = useBranches({ limit: 100 })
  const { data, isLoading } = useApPayments(apiQuery)
  const deletePayment = useDeleteApPayment()

  const payments = data?.data ?? []
  const pagination = data?.pagination

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePayment.mutateAsync(deleteTarget.id)
      toast.success('Pembayaran dihapus')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Wallet className="w-6 h-6 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                AP Payments
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Pembayaran hutang dagang · {pagination?.total ?? 0} dokumen
              </p>
            </div>
          </div>
          {canInsert && (
            <Link
              to={`${AP_PAYMENTS_LIST_PATH}/new`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Buat Pembayaran
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto py-2">
          {AP_LIST_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilters({ tab: tab.id, status: '' })}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                isApListTabActive(tab.id, filters)
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
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor pembayaran..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ status: (e.target.value || '') as ApPaymentStatus | '' })
            }
            className="px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
          >
            <option value="">Semua status</option>
            {(Object.keys(AP_STATUS_CONFIG) as ApPaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {AP_STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          <select
            value={filters.supplierId}
            onChange={(e) => setFilters({ supplierId: e.target.value })}
            className="px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white min-w-[160px]"
          >
            <option value="">Semua supplier</option>
            {(suppliersData?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
          <select
            value={filters.branchId}
            onChange={(e) => setFilters({ branchId: e.target.value })}
            className="px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white min-w-[140px]"
          >
            <option value="">Semua cabang</option>
            {(branchesData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <Wallet className="mx-auto w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Belum ada pembayaran AP</p>
            {canInsert && (
              <Link
                to={`${AP_PAYMENTS_LIST_PATH}/new`}
                className="inline-block mt-4 text-blue-600 hover:underline text-sm font-medium"
              >
                Buat pembayaran pertama
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const st = AP_STATUS_CONFIG[p.status]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openDetail(`${AP_PAYMENTS_LIST_PATH}/${p.id}`)}
                  className="w-full text-left p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {p.payment_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {p.supplier_name} · {p.branch_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {AP_PAYMENT_METHOD_LABELS[p.payment_method]} ·{' '}
                        {p.bank_account_name} · {p.invoice_count} invoice
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {fmtCurrency(Number(p.total_amount))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fmtDate(p.payment_date ?? p.created_at)}
                      </p>
                    </div>
                  </div>
                  {p.status === 'DRAFT' && canDelete && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(p)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation()
                            setDeleteTarget(p)
                          }
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Hapus draft
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {pagination && pagination.total > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus pembayaran?"
        message={`Draft ${deleteTarget?.payment_number} akan dihapus.`}
        confirmText="Hapus"
        variant="danger"
        isLoading={deletePayment.isPending}
      />
    </div>
  )
}
