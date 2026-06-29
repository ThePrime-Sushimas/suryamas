import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, FileText, Printer } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useListNavigation } from '@/lib/urlFilters'
import { PettyCashStatusBadge } from '../components/PettyCashStatusBadge'
import { PettyCashExpenseTable } from '../components/PettyCashExpenseTable'
import { PettyCashExpenseFormModal } from '../components/PettyCashExpenseFormModal'
import { PettyCashExpenseEditModal } from '../components/PettyCashExpenseEditModal'
import { PettyCashApproveModal } from '../components/PettyCashApproveModal'
import { PettyCashRejectModal } from '../components/PettyCashRejectModal'
import { PettyCashVoidModal } from '../components/PettyCashVoidModal'
import { PrintPettyCashModal } from '../components/PrintPettyCashModal'
import { usePettyCashDetailPage } from '../hooks/usePettyCashDetailPage'
import { usePettyCashDetailModals } from '../hooks/usePettyCashDetailModals'
import { fmtCurrency } from '../utils/pettyCash.formatters'

export default function PettyCashDetailPage() {
  const { id } = useParams<{ id: string }>()
  const requestId = id ?? ''
  const navigate = useNavigate()
  const { backToList } = useListNavigation('/finance/petty-cash')

  const { request, isLoading, remaining, expenses, canApprove, canInsert, canRelease } =
    usePettyCashDetailPage(requestId)
  const modals = usePettyCashDetailModals(requestId)

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!request) return <div className="text-center py-12 text-gray-500">Request tidak ditemukan</div>

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
              onClick={() => modals.setShowPrint(true)}
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
              <button onClick={() => modals.setShowApprove(true)} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">Approve</button>
              <button onClick={() => modals.setShowReject(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Reject</button>
            </>
          )}
          {request.status === 'DISBURSED' && canInsert && (
            <>
              <button onClick={() => modals.setShowExpenseForm(true)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus className="w-4 h-4" /> Tambah Expense</button>
              <button onClick={() => navigate(`/finance/petty-cash/${id}/settlement`)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><FileText className="w-4 h-4" /> Buat Settlement</button>
            </>
          )}
          {request.status === 'CLOSED' && canRelease && request.can_void && request.settlement_id && (
            <button onClick={() => modals.setShowVoid(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Void Settlement</button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <PettyCashExpenseTable
        expenses={expenses}
        requestStatus={request.status}
        onEdit={modals.setEditingExpense}
        onDelete={modals.setDeleteExpenseId}
      />

      {/* Modals */}
      <PettyCashApproveModal
        open={modals.showApprove}
        onClose={() => modals.setShowApprove(false)}
        requestId={requestId}
        defaultAmount={request.amount_requested}
      />

      <PettyCashRejectModal
        open={modals.showReject}
        onClose={() => modals.setShowReject(false)}
        requestId={requestId}
      />

      <PettyCashExpenseFormModal
        open={modals.showExpenseForm}
        onClose={() => modals.setShowExpenseForm(false)}
        requestId={requestId}
      />

      <PettyCashExpenseEditModal
        open={!!modals.editingExpense}
        onClose={() => modals.setEditingExpense(null)}
        expense={modals.editingExpense}
        requestId={requestId}
      />

      {request.settlement_id && (
        <PettyCashVoidModal
          open={modals.showVoid}
          onClose={() => modals.setShowVoid(false)}
          settlementId={request.settlement_id}
          requestId={requestId}
        />
      )}

      <ConfirmModal
        isOpen={!!modals.deleteExpenseId}
        onClose={() => modals.setDeleteExpenseId(null)}
        onConfirm={modals.handleDeleteExpense}
        title="Hapus Expense"
        message="Yakin ingin menghapus pengeluaran ini?"
        confirmText="Hapus"
        variant="danger"
        isLoading={modals.isDeleteExpensePending}
      />

      {modals.showPrint && (
        <PrintPettyCashModal
          requestId={requestId}
          onClose={() => modals.setShowPrint(false)}
        />
      )}
    </div>
  )
}
