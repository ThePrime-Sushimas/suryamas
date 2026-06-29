import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, FileText, Printer } from 'lucide-react'
import { Button, Dialog } from '@/components/ui'
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

  const handleDeleteClose = () => {
    if (modals.isDeleteExpensePending) return
    modals.setDeleteExpenseId(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!request) {
    return <div className="py-12 text-center text-gray-500">Request tidak ditemukan</div>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => backToList()}
        className="-ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        Kembali
      </Button>

      <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {request.request_number}
            </h2>
            <p className="text-sm text-gray-500">
              {request.branch_name} · {request.petty_cash_coa_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={
                <Printer className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              }
              onClick={() => modals.setShowPrint(true)}
            >
              <span className="hidden sm:inline">Print Thermal</span>
              <span className="sm:hidden">Print</span>
            </Button>
            <PettyCashStatusBadge status={request.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <span className="text-gray-500">Diajukan</span>
            <p className="font-medium">{fmtCurrency(request.amount_requested)}</p>
          </div>
          <div>
            <span className="text-gray-500">Dicairkan</span>
            <p className="font-medium">{fmtCurrency(request.amount_disbursed)}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Expense</span>
            <p className="font-medium">{fmtCurrency(request.total_expenses)}</p>
          </div>
          <div>
            <span className="text-gray-500">Saldo Tersisa</span>
            <p className="font-semibold text-blue-600">
              {fmtCurrency(remaining > 0 ? remaining : 0)}
            </p>
          </div>
        </div>

        {request.carried_amount > 0 && (
          <p className="text-xs text-gray-500">
            Termasuk carry: {fmtCurrency(request.carried_amount)}
          </p>
        )}
        {request.rejection_reason && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Alasan tolak: {request.rejection_reason}
          </p>
        )}
        {request.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{request.description}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {request.status === 'PENDING' && canApprove && (
            <>
              <Button variant="primary" onClick={() => modals.setShowApprove(true)}>
                Approve
              </Button>
              <Button variant="danger" onClick={() => modals.setShowReject(true)}>
                Reject
              </Button>
            </>
          )}
          {request.status === 'DISBURSED' && canInsert && (
            <>
              <Button
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => modals.setShowExpenseForm(true)}
              >
                Tambah Expense
              </Button>
              <Button
                variant="secondary"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() => navigate(`/finance/petty-cash/${id}/settlement`)}
              >
                Buat Settlement
              </Button>
            </>
          )}
          {request.status === 'CLOSED' && canRelease && request.can_void && request.settlement_id && (
            <Button variant="danger" onClick={() => modals.setShowVoid(true)}>
              Void Settlement
            </Button>
          )}
        </div>
      </div>

      <PettyCashExpenseTable
        expenses={expenses}
        requestStatus={request.status}
        onEdit={modals.setEditingExpense}
        onDelete={modals.setDeleteExpenseId}
      />

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

      <Dialog
        isOpen={!!modals.deleteExpenseId}
        onClose={handleDeleteClose}
        size="sm"
        preventClose={modals.isDeleteExpensePending}
      >
        <Dialog.Header>Hapus Expense</Dialog.Header>
        <Dialog.Body>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Yakin ingin menghapus pengeluaran ini?
          </p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            variant="secondary"
            onClick={handleDeleteClose}
            disabled={modals.isDeleteExpensePending}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            loading={modals.isDeleteExpensePending}
            onClick={modals.handleDeleteExpense}
          >
            Hapus
          </Button>
        </Dialog.Footer>
      </Dialog>

      {modals.showPrint && (
        <PrintPettyCashModal
          requestId={requestId}
          onClose={() => modals.setShowPrint(false)}
        />
      )}
    </div>
  )
}
