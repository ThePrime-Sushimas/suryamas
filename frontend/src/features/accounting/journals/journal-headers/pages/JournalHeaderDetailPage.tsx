import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit, Trash2, Send, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalStatusBadge } from '../components/JournalStatusBadge'
import { JournalTypeBadge } from '../components/JournalTypeBadge'
import { BalanceIndicator } from '../../journal-lines/components/BalanceIndicator'
import { formatCurrency, formatDate, calculateBalance } from '../../shared/journal.utils'
import { canTransitionTo } from '../../shared/journal.constants'
import type { JournalLineWithDetails } from '../../shared/journal.types'

export function JournalHeaderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    selectedJournal,
    loading,
    mutating,
    fetchJournalById,
    deleteJournal,
    submitJournal,
    approveJournal,
    rejectJournal,
    postJournal,
    reverseJournal,
  } = useJournalHeadersStore()

  const [rejectReason, setRejectReason] = useState('')
  const [reverseReason, setReverseReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showReverseModal, setShowReverseModal] = useState(false)

  useEffect(() => {
    if (id) {
      fetchJournalById(id)
    }
  }, [id, fetchJournalById])

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>
  }

  if (!selectedJournal) {
    return <div className="p-6 text-center text-red-600">Journal not found</div>
  }

  const balance = calculateBalance(selectedJournal.lines || [])
  const canEdit = selectedJournal.status === 'DRAFT'
  const canDelete = selectedJournal.status === 'DRAFT'
  const canSubmit = canTransitionTo(selectedJournal.status, 'SUBMITTED')
  const canApprove = canTransitionTo(selectedJournal.status, 'APPROVED')
  const canReject = selectedJournal.status === 'SUBMITTED' || selectedJournal.status === 'APPROVED'
  const canPost = canTransitionTo(selectedJournal.status, 'POSTED')
  const canReverse = selectedJournal.status === 'POSTED' && !selectedJournal.is_reversed

  const handleEdit = () => navigate(`/accounting/journals/${id}/edit`)
  
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this journal?')) {
      await deleteJournal(id!)
      navigate('/accounting/journals')
    }
  }

  const handleSubmit = async () => {
    await submitJournal(id!)
    fetchJournalById(id!)
  }

  const handleApprove = async () => {
    await approveJournal(id!)
    fetchJournalById(id!)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    await rejectJournal(id!, { rejection_reason: rejectReason })
    setShowRejectModal(false)
    setRejectReason('')
    fetchJournalById(id!)
  }

  const handlePost = async () => {
    if (confirm('Are you sure you want to post this journal to the general ledger?')) {
      await postJournal(id!)
      fetchJournalById(id!)
    }
  }

  const handleReverse = async () => {
    if (!reverseReason.trim()) {
      alert('Please provide a reversal reason')
      return
    }
    await reverseJournal(id!, { reversal_reason: reverseReason })
    setShowReverseModal(false)
    setReverseReason('')
    navigate('/accounting/journals')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{selectedJournal.journal_number}</h1>
          <p className="text-gray-600 mt-1">{selectedJournal.description}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
            >
              <Edit size={18} />
              Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
            >
              <Trash2 size={18} />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white border rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Date</p>
            <p className="font-medium">{formatDate(selectedJournal.journal_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Period</p>
            <p className="font-medium">{selectedJournal.period}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Type</p>
            <JournalTypeBadge type={selectedJournal.journal_type} />
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <JournalStatusBadge status={selectedJournal.status} />
          </div>
          {selectedJournal.branch_name && (
            <div>
              <p className="text-sm text-gray-600">Branch</p>
              <p className="font-medium">{selectedJournal.branch_name}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Currency</p>
            <p className="font-medium">
              {selectedJournal.currency || 'IDR'}
              {selectedJournal.exchange_rate && selectedJournal.exchange_rate !== 1 && (
                <span className="text-sm text-gray-600"> (Rate: {selectedJournal.exchange_rate})</span>
              )}
            </p>
          </div>
        </div>

        {selectedJournal.reference_number && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">Reference</p>
            <p className="font-medium">{selectedJournal.reference_number}</p>
          </div>
        )}

        {selectedJournal.is_reversed && (
          <div className="mt-4 pt-4 border-t bg-red-50 -m-6 p-6 rounded-b-lg">
            <p className="text-red-800 font-medium">⚠️ This journal has been reversed</p>
            {selectedJournal.reversal_reason && (
              <p className="text-red-700 text-sm mt-1">Reason: {selectedJournal.reversal_reason}</p>
            )}
          </div>
        )}
      </div>

      {/* Lines Table */}
      <div className="bg-white border rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Journal Lines</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-36">Debit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-36">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(selectedJournal.lines && selectedJournal.lines.length > 0) ? (
                selectedJournal.lines.map((line) => {
                  const lineWithDetails = line as JournalLineWithDetails
                  return (
                    <tr key={line.id || line.line_number} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{line.line_number}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{lineWithDetails.account_code || line.account_id}</div>
                        {lineWithDetails.account_name && (
                          <div className="text-xs text-gray-500">{lineWithDetails.account_name}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{line.description || '-'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {line.debit_amount > 0 ? formatCurrency(line.debit_amount, selectedJournal.currency) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {line.credit_amount > 0 ? formatCurrency(line.credit_amount, selectedJournal.currency) : '-'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">No journal lines</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t font-semibold">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right">Total:</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatCurrency(selectedJournal.total_debit || 0, selectedJournal.currency)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatCurrency(selectedJournal.total_credit || 0, selectedJournal.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 border-t">
          <BalanceIndicator balance={balance} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={mutating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={18} />
            Submit for Approval
          </button>
        )}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={mutating}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle size={18} />
            Approve
          </button>
        )}
        {canReject && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={mutating}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            <XCircle size={18} />
            Reject
          </button>
        )}
        {canPost && (
          <button
            onClick={handlePost}
            disabled={mutating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            <CheckCircle size={18} />
            Post to GL
          </button>
        )}
        {canReverse && (
          <button
            onClick={() => setShowReverseModal(true)}
            disabled={mutating}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            <RotateCcw size={18} />
            Reverse
          </button>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Journal</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full border rounded p-2 mb-4"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reverse Journal</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create a new journal with inverted debit/credit amounts.
            </p>
            <textarea
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Enter reversal reason..."
              className="w-full border rounded p-2 mb-4"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowReverseModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReverse}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Reverse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
