import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, FileText, Printer } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useListNavigation } from '@/lib/urlFilters'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { usePettyCashRequest, useDeleteExpense } from '../api/pettyCash.api'
import { PettyCashStatusBadge } from '../components/PettyCashStatusBadge'
import { PettyCashExpenseTable } from '../components/PettyCashExpenseTable'
import { PettyCashExpenseFormModal } from '../components/PettyCashExpenseFormModal'
import { PettyCashExpenseEditModal } from '../components/PettyCashExpenseEditModal'
import { PettyCashApproveModal } from '../components/PettyCashApproveModal'
import { PettyCashRejectModal } from '../components/PettyCashRejectModal'
import { PettyCashVoidModal } from '../components/PettyCashVoidModal'
import { PrintPettyCashModal } from '../components/PrintPettyCashModal'
import type { PettyCashExpense } from '../types/pettyCash.types'

const fmtCurrency = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export default function PettyCashDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { backToList } = useListNavigation('/finance/petty-cash')
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canApprove = hasPermission('petty_cash', 'approve')
  const canInsert = hasPermission('petty_cash', 'insert')
  const canRelease = hasPermission('petty_cash', 'release')

  const { data: request, isLoading } = usePettyCashRequest(id ?? '')
  const deleteExpenseMutation = useDeleteExpense()

  // Modal visibility
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<PettyCashExpense | null>(null)

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId || !id) return
    try {
      await deleteExpenseMutation.mutateAsync({ id: deleteExpenseId, requestId: id })
      setDeleteExpenseId(null)
    } catch (err) { toast.error(parseApiError(err, 'Gagal hapus expense')) }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!request) return <div className="text-center py-12 text-gray-500">Request tidak ditemukan</div>

  const remaining = request.total_disbursed - request.total_expenses
  const expenses: PettyCashExpense[] = request.expenses ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => backToList()} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Request Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{request.request_number}</h2>
            <p className="text-sm text-gray-500">{request.branch_name} · {request.petty_cash_coa_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrint(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">Print Thermal</span>
            </button>
            <PettyCashStatusBadge status={request.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Diajukan</span><p className="font-medium">{fmtCurrency(request.amount_requested)}</p></div>
          <div><span className="text-gray-500">Dicairkan</span><p className="font-medium">{fmtCurrency(request.amount_disbursed)}</p></div>
          <div><span className="text-gray-500">Total Expense</span><p className="font-medium">{fmtCurrency(request.total_expenses)}</p></div>
          <div><span className="text-gray-500">Saldo Tersisa</span><p className="font-semibold text-blue-600">{fmtCurrency(remaining > 0 ? remaining : 0)}</p></div>
        </div>

        {request.carried_amount > 0 && (
          <p className="text-xs text-gray-500">Termasuk carry: {fmtCurrency(request.carried_amount)}</p>
        )}
        {request.rejection_reason && (
          <p className="text-sm text-red-600 dark:text-red-400">Alasan tolak: {request.rejection_reason}</p>
        )}
        {request.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{request.description}</p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {request.status === 'PENDING' && canApprove && (
            <>
              <button onClick={() => setShowApprove(true)} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">Approve</button>
              <button onClick={() => setShowReject(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Reject</button>
            </>
          )}
          {request.status === 'DISBURSED' && canInsert && (
            <>
              <button onClick={() => setShowExpenseForm(true)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus className="w-4 h-4" /> Tambah Expense</button>
              <button onClick={() => navigate(`/finance/petty-cash/${id}/settlement`)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><FileText className="w-4 h-4" /> Buat Settlement</button>
            </>
          )}
          {request.status === 'CLOSED' && canRelease && request.settlement_id && (
            <button onClick={() => setShowVoid(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Void Settlement</button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <PettyCashExpenseTable
        expenses={expenses}
        requestStatus={request.status}
        onEdit={setEditingExpense}
        onDelete={setDeleteExpenseId}
      />

      {/* Modals */}
      <PettyCashApproveModal
        open={showApprove}
        onClose={() => setShowApprove(false)}
        requestId={id ?? ''}
        defaultAmount={request.amount_requested}
      />

      <PettyCashRejectModal
        open={showReject}
        onClose={() => setShowReject(false)}
        requestId={id ?? ''}
      />

      <PettyCashExpenseFormModal
        open={showExpenseForm}
        onClose={() => setShowExpenseForm(false)}
        requestId={id ?? ''}
      />

      <PettyCashExpenseEditModal
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        requestId={id ?? ''}
      />

      {request.settlement_id && (
        <PettyCashVoidModal
          open={showVoid}
          onClose={() => setShowVoid(false)}
          settlementId={request.settlement_id}
          requestId={id ?? ''}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteExpenseId}
        onClose={() => setDeleteExpenseId(null)}
        onConfirm={handleDeleteExpense}
        title="Hapus Expense"
        message="Yakin ingin menghapus pengeluaran ini?"
        confirmText="Hapus"
        variant="danger"
        isLoading={deleteExpenseMutation.isPending}
      />

      {showPrint && (
        <PrintPettyCashModal
          requestId={id ?? ''}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
