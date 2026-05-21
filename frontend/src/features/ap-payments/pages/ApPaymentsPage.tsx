import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { Wallet, Search, Plus, X, LayoutDashboard } from 'lucide-react'
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
  AP_DASHBOARD_PATH,
  AP_PAYMENT_METHOD_LABELS,
  AP_STATUS_CONFIG,
} from '../constants'
import { isApListTabActive } from '../utils/apPaymentFilters.url'
import { useApPayments, useDeleteApPayment, type ApPayment } from '../api/apPayments.api'
import { useApPaymentFilters } from '../hooks/useApPaymentFilters'
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { apTheme } from '../ap-payments.theme'
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
    <ApPaymentsShell fullHeight className="flex flex-col">
      <div className={`${apTheme.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={apTheme.headerIcon}>
              <Wallet className="w-6 h-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg sm:text-xl font-bold truncate ${apTheme.title}`}>
                AP Payments
              </h1>
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>
                Pembayaran hutang dagang · {pagination?.total ?? 0} dokumen
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              to={AP_DASHBOARD_PATH}
              className={apTheme.btnSecondary}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            {canInsert && (
              <Link
                to={`${AP_PAYMENTS_LIST_PATH}/new`}
                className={apTheme.btnPrimary}
              >
                <Plus className="w-4 h-4" />
                Buat Pembayaran
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className={`${apTheme.header} px-4 sm:px-6`}>
        <div className="flex gap-1 overflow-x-auto py-2">
          {AP_LIST_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilters({ tab: tab.id, status: '' })}
              className={`transition-colors ${
                isApListTabActive(tab.id, filters)
                  ? apTheme.listTabActive
                  : apTheme.listTabInactive
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor pembayaran..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={apTheme.inputSearch}
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
            className={apTheme.select}
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
            className={`${apTheme.select} min-w-40`}
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
            className={`${apTheme.select} min-w-[140px]`}
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
                className={apTheme.skeleton}
              />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <Wallet className="mx-auto w-12 h-12 text-rose-300 dark:text-gray-600 mb-4" />
            <p className={apTheme.muted}>Belum ada pembayaran AP</p>
            {canInsert && (
              <Link
                to={`${AP_PAYMENTS_LIST_PATH}/new`}
                className={`inline-block mt-4 text-sm font-medium ${apTheme.link}`}
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
                  className={apTheme.listCard}
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
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            onLimitChange={setLimit}
            currentLength={payments.length}
            loading={isLoading}
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
    </ApPaymentsShell>
  )
}
