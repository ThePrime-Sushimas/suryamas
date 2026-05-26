import { useState, useCallback } from 'react'
import { Plus, Search, Eye, Edit2, Trash2, Send, XCircle, Receipt } from 'lucide-react'

import { useGeneralInvoices, usePostGeneralInvoice, useCancelGeneralInvoice, useDeleteGeneralInvoice } from '../api/generalApi.api'
import InvoiceFormModal from './InvoiceFormModal'

import {
  formatRupiah,
  formatDate,
  isOverdue,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  EXPENSE_TYPE_LABELS,
  INVOICE_STATUS_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
} from '../constants'
import type { GeneralInvoice, GeneralInvoiceStatus, ExpenseType } from '../api/generalApi.api'

interface Props {
  onCreateInvoice?: () => void
  onEditInvoice?: (invoice: GeneralInvoice) => void
  onViewInvoice?: (invoice: GeneralInvoice) => void
  onCreatePayment?: (invoice: GeneralInvoice) => void
  initialStatus?: GeneralInvoiceStatus
}

export default function GeneralInvoicesPage({
  onEditInvoice,

  onViewInvoice,
  onCreatePayment,
  initialStatus,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<GeneralInvoiceStatus | ''>(initialStatus ?? '')
  const [expenseType, setExpenseType] = useState<ExpenseType | ''>('')
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<GeneralInvoice | null>(null)
  const [confirmPost, setConfirmPost] = useState<GeneralInvoice | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<GeneralInvoice | null>(null)

  const params = {
    search: search || undefined,
    status: status || undefined,
    expense_type: expenseType || undefined,
    page,
    limit: 20,
  }

  const { data, isLoading } = useGeneralInvoices(params)

  const postMutation = usePostGeneralInvoice()
  const cancelMutation = useCancelGeneralInvoice()
  const deleteMutation = useDeleteGeneralInvoice()

  const handlePost = useCallback(async () => {
    if (!confirmPost) return
    await postMutation.mutateAsync(confirmPost.id)
    setConfirmPost(null)
  }, [confirmPost, postMutation])

  const handleCancel = useCallback(async () => {
    if (!confirmCancel) return
    await cancelMutation.mutateAsync(confirmCancel.id)
    setConfirmCancel(null)
  }, [confirmCancel, cancelMutation])

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return
    await deleteMutation.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }, [confirmDelete, deleteMutation])

  const invoices = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1


  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">General Invoice</h1>
          <p className="text-sm text-gray-500">{total} total invoice</p>
        </div>
        <button
          type="button"
          onClick={() => { setCreateOpen(true) }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Buat Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor invoice atau vendor..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as GeneralInvoiceStatus | ''); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Status</option>
          {INVOICE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={expenseType}
          onChange={(e) => { setExpenseType(e.target.value as ExpenseType | ''); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Kategori</option>
          {EXPENSE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Receipt size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Tidak ada invoice</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Invoice</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tgl Invoice</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Jatuh Tempo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => {
                    const overdue = inv.status === 'POSTED' && isOverdue(inv.due_date) && !inv.journal_id
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">
                          {inv.invoice_number}
                          {inv.is_confidential && (
                            <span className="ml-1 text-xs text-purple-500" title="Konfidensial">🔒</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{inv.vendor_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {EXPENSE_TYPE_LABELS[inv.expense_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                            {formatDate(inv.due_date)}
                            {overdue && ' ⚠️'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatRupiah(inv.total_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ActionButton
                              icon={<Eye size={13} />}
                              tooltip="Lihat"
                              onClick={() => onViewInvoice?.(inv)}
                            />
                            {inv.status === 'DRAFT' && (
                              <>
                                <ActionButton
                                  icon={<Edit2 size={13} />}
                                  tooltip="Edit"
                                  onClick={() => onEditInvoice?.(inv)}
                                />
                                <ActionButton
                                  icon={<Send size={13} />}
                                  tooltip="Posting"
                                  className="text-blue-600 hover:bg-blue-50"
                                  onClick={() => setConfirmPost(inv)}
                                />
                                <ActionButton
                                  icon={<Trash2 size={13} />}
                                  tooltip="Hapus"
                                  className="text-red-500 hover:bg-red-50"
                                  onClick={() => setConfirmDelete(inv)}
                                />
                              </>
                            )}
                            {inv.status === 'POSTED' && (
                              <>
                                <ActionButton
                                  icon={<Receipt size={13} />}
                                  tooltip="Buat Payment"
                                  className="text-green-600 hover:bg-green-50"
                                  onClick={() => onCreatePayment?.(inv)}
                                />
                                <ActionButton
                                  icon={<XCircle size={13} />}
                                  tooltip="Batalkan"
                                  className="text-red-500 hover:bg-red-50"
                                  onClick={() => setConfirmCancel(inv)}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {invoices.map((inv) => {
                const overdue = inv.status === 'POSTED' && isOverdue(inv.due_date)
                return (
                  <div key={inv.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-gray-900">{inv.invoice_number}</p>
                        <p className="text-sm font-medium text-gray-700">{inv.vendor_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${INVOICE_STATUS_COLORS[inv.status]}`}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{EXPENSE_TYPE_LABELS[inv.expense_type]}</span>
                      <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                        Due: {formatDate(inv.due_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{formatRupiah(inv.total_amount)}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onViewInvoice?.(inv)}
                          className="text-xs text-blue-600 underline"
                        >Lihat</button>
                        {inv.status === 'DRAFT' && (
                          <button
                            onClick={() => setConfirmPost(inv)}
                            className="text-xs text-blue-600 underline"
                          >Posting</button>
                        )}
                        {inv.status === 'POSTED' && (
                          <button
                            onClick={() => onCreatePayment?.(inv)}
                            className="text-xs text-green-600 underline"
                          >Bayar</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Hal {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >← Prev</button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >Next →</button>
          </div>
        </div>
      )}

      {/* Confirm Post Modal */}
      {confirmPost && (
        <ConfirmModal
          title="Posting Invoice?"
          message={`Invoice ${confirmPost.invoice_number} akan diposting dan jurnal hutang usaha akan dibuat secara otomatis. Tindakan ini tidak bisa dibatalkan kecuali via Cancel.`}
          confirmLabel="Ya, Posting"
          confirmClass="bg-blue-600 hover:bg-blue-700 text-white"
          onConfirm={handlePost}
          onCancel={() => setConfirmPost(null)}
          loading={postMutation.isPending}
        />
      )}

      {/* Confirm Cancel Modal */}
      {confirmCancel && (
        <ConfirmModal
          title="Batalkan Invoice?"
          message={`Invoice ${confirmCancel.invoice_number} akan dibatalkan. Jurnal yang sudah dibuat akan dihapus.`}
          confirmLabel="Ya, Batalkan"
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleCancel}
          onCancel={() => setConfirmCancel(null)}
          loading={cancelMutation.isPending}
        />
      )}

      <InvoiceFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <ConfirmModal
          title="Hapus Invoice?"
          message={`Invoice ${confirmDelete.invoice_number} akan dihapus permanen (hanya bisa untuk status DRAFT).`}
          confirmLabel="Hapus"
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────
function ActionButton({
  icon,
  tooltip,
  onClick,
  className = 'text-gray-500 hover:bg-gray-100',
}: {
  icon: React.ReactNode
  tooltip: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 rounded-md transition-colors ${className}`}
    >
      {icon}
    </button>
  )
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmClass: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? 'Proses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}