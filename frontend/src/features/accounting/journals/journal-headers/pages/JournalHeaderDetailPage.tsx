import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  Edit, Trash2, Send, CheckCircle, XCircle, RotateCcw, 
  ArrowLeft, Copy, Printer, MoreHorizontal, Calendar, 
  Building2, FileText, Banknote, Clock, Tag
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalStatusBadge } from '../components/JournalStatusBadge'
import { JournalTypeBadge } from '../components/JournalTypeBadge'
import { BalanceIndicator } from '../../journal-lines/components/BalanceIndicator'
import { formatCurrency, formatDateShort } from '../../shared/journal.utils'
import { canTransitionTo } from '../../shared/journal.constants'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import type { JournalLineWithDetails } from '../../shared/journal.types'
import type { JournalHeaderWithLines } from '../types/journal-header.types'

export function JournalHeaderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useTheme()
  const permissions = useJournalPermissions()
  const toast = useToast()
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Loading states for modal operations
  const [isPosting, setIsPosting] = useState(false)
  const [isReversing, setIsReversing] = useState(false)

  useEffect(() => {
    if (id) {
      fetchJournalById(id)
    }
  }, [id, fetchJournalById])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Memuat data jurnal...</p>
        </div>
      </div>
    )
  }

  if (!selectedJournal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Jurnal Tidak Ditemukan</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Jurnal yang Anda cari tidak ada atau telah dihapus.</p>
          <button
            onClick={() => navigate('/accounting/journals')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft size={18} />
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  const balance = calculateBalance(selectedJournal.lines || [])
  const canEdit = permissions.canEdit && selectedJournal.status === 'DRAFT'
  const canDelete = permissions.canDelete && selectedJournal.status === 'DRAFT'
  const canSubmit = permissions.canSubmit && canTransitionTo(selectedJournal.status, 'SUBMITTED')
  const canApprove = permissions.canApprove && canTransitionTo(selectedJournal.status, 'APPROVED')
  const canReject = permissions.canReject && (selectedJournal.status === 'SUBMITTED' || selectedJournal.status === 'APPROVED')
  const canPost = permissions.canPost && canTransitionTo(selectedJournal.status, 'POSTED')
  const canReverse = permissions.canReverse && selectedJournal.status === 'POSTED' && !selectedJournal.is_reversed

  const handleEdit = () => navigate(`/accounting/journals/${id}/edit`)
  
  const handleDelete = async () => {
    await deleteJournal(id!)
    navigate('/accounting/journals')
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
      setShowRejectModal(true)
      return
    }
    await rejectJournal(id!, { rejection_reason: rejectReason })
    setShowRejectModal(false)
    setShowRejectConfirmModal(false)
    setRejectReason('')
    fetchJournalById(id!)
  }

  const handlePost = async () => {
    setIsPosting(true)
    try {
      await postJournal(id!)
      await fetchJournalById(id!)
      setShowPostModal(false)
      toast.success('Jurnal berhasil diposting ke buku besar')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memposting jurnal')
    } finally {
      setIsPosting(false)
    }
  }

  const handleReverse = async () => {
    if (!reverseReason.trim()) {
      return
    }
    setIsReversing(true)
    try {
      await reverseJournal(id!, { reversal_reason: reverseReason })
      setShowReverseModal(false)
      setReverseReason('')
      toast.success('Jurnal berhasil dibalikkan')
      navigate('/accounting/journals')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membalikkan jurnal')
    } finally {
      setIsReversing(false)
    }
  }

  const handleCopyJournalNumber = async () => {
    await navigator.clipboard.writeText(selectedJournal.journal_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Breadcrumb & Back */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/accounting/journals')}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">Kembali</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <nav className="hidden md:flex items-center gap-2 text-sm">
                <button
                  onClick={() => navigate('/accounting/journals')}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Jurnal
                </button>
                <span className="text-gray-400 dark:text-gray-500">/</span>
                <span className="text-gray-900 dark:text-white font-medium">Detail</span>
              </nav>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyJournalNumber}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                    <span className="hidden sm:inline text-green-600 dark:text-green-400">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span className="hidden sm:inline">Salin No. Jurnal</span>
                  </>
                )}
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Printer size={18} />
                <span className="hidden sm:inline">Cetak</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              {/* Journal Title */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedJournal.journal_number}
                  </h1>
                  <JournalStatusBadge status={selectedJournal.status} />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg">{selectedJournal.description}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    <Edit size={18} />
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={18} />
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <QuickStatItem
                icon={<Calendar className="w-5 h-5" />}
                label="Tanggal"
                value={formatDateShort(selectedJournal.journal_date)}
              />
              <QuickStatItem
                icon={<FileText className="w-5 h-5" />}
                label="Tipe"
                value={<JournalTypeBadge type={selectedJournal.journal_type} />}
              />
              <QuickStatItem
                icon={<Banknote className="w-5 h-5" />}
                label="Mata Uang"
                value={
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedJournal.currency || 'IDR'}
                    {selectedJournal.exchange_rate && selectedJournal.exchange_rate !== 1 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(Rate: {selectedJournal.exchange_rate})</span>
                    )}
                  </span>
                }
              />
              {selectedJournal.branch_name && (
                <QuickStatItem
                  icon={<Building2 className="w-5 h-5" />}
                  label="Cabang"
                  value={selectedJournal.branch_name}
                />
              )}
              {selectedJournal.reference_number && (
                <QuickStatItem
                  icon={<Tag className="w-5 h-5" />}
                  label="Referensi"
                  value={selectedJournal.reference_number}
                />
              )}
              <QuickStatItem
                icon={<Banknote className="w-5 h-5" />}
                label="Total"
                value={
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(selectedJournal.total_debit || 0, selectedJournal.currency)}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        {/* Reversed Alert */}
        {selectedJournal.is_reversed && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-300">Jurnal Telah Dibalikkan</h3>
                {selectedJournal.reversal_reason && (
                  <p className="text-red-700 dark:text-red-400 text-sm mt-1">Alasan: {selectedJournal.reversal_reason}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Journal Lines Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Rincian Jurnal
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedJournal.lines?.length || 0} baris
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Akun</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Deskripsi</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-36">Debit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-36">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(selectedJournal.lines && selectedJournal.lines.length > 0) ? (
                      selectedJournal.lines.map((line, index) => {
                        const lineWithDetails = line as JournalLineWithDetails
                        const isEven = index % 2 === 0
                        return (
                          <tr key={line.id || line.line_number} className={`hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${isEven ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">{line.line_number}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {lineWithDetails.account_code || line.account_id}
                              </div>
                              {lineWithDetails.account_name && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{lineWithDetails.account_name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.description || '-'}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                              {line.debit_amount > 0 ? (
                                <span className="text-gray-900 dark:text-white">{formatCurrency(line.debit_amount, selectedJournal.currency)}</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                              {line.credit_amount > 0 ? (
                                <span className="text-gray-900 dark:text-white">{formatCurrency(line.credit_amount, selectedJournal.currency)}</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center">
                            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                            <p>Tidak ada rincian jurnal</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 dark:bg-gray-700 border-t dark:border-gray-600 font-semibold">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">Total:</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-gray-900 dark:text-white">
                        {formatCurrency(selectedJournal.total_debit || 0, selectedJournal.currency)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-gray-900 dark:text-white">
                        {formatCurrency(selectedJournal.total_credit || 0, selectedJournal.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <BalanceIndicator balance={balance} currency={selectedJournal.currency} />
              </div>
            </div>

            {/* Rejection Reason Alert */}
            {selectedJournal.rejection_reason && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-800 dark:text-orange-300">Alasan Penolakan</h3>
                    <p className="text-orange-700 dark:text-orange-400 text-sm mt-1">{selectedJournal.rejection_reason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Audit Timeline */}
          <div className="space-y-6">
            <AuditTimelineCard journal={selectedJournal} />
            
            {/* Action Buttons Card */}
            <ActionButtonsCard
              canSubmit={canSubmit}
              canApprove={canApprove}
              canReject={canReject}
              canPost={canPost}
              canReverse={canReverse}
              mutating={mutating}
              handleSubmit={handleSubmit}
              handleApprove={handleApprove}
              handlePost={async () => setShowPostModal(true)}
              setShowRejectModal={() => setShowRejectConfirmModal(true)}
              setShowReverseModal={setShowReverseModal}
            />
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tolak Jurnal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Berikan alasan penolakan</p>
                </div>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masukkan alasan penolakan..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={4}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Tolak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Balikkan Jurnal</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Aksi ini akan membuat jurnal baru dengan nilai terbalik</p>
                </div>
              </div>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Masukkan alasan pembalikan..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={4}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowReverseModal(false)}
                  disabled={isReversing}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleReverse}
                  disabled={isReversing}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isReversing ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Balikkan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Hapus Jurnal"
        message="Apakah Anda yakin ingin menghapus jurnal ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />

      {/* Post Confirmation Modal */}
      <ConfirmModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onConfirm={handlePost}
        title="Posting Jurnal"
        message="Apakah Anda yakin ingin memposting jurnal ini ke buku besar? Jurnal yang sudah diposting tidak dapat diubah."
        confirmText="Posting"
        cancelText="Batal"
        variant="warning"
        isLoading={isPosting}
      />

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={showRejectConfirmModal}
        onClose={() => setShowRejectConfirmModal(false)}
        onConfirm={() => {
          setShowRejectConfirmModal(false)
          setShowRejectModal(true)
        }}
        title="Tolak Jurnal"
        message="Apakah Anda yakin ingin menolak jurnal ini? Harap berikan alasan penolakan."
        confirmText="Lanjutkan"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  )
}

// Helper Components
function QuickStatItem({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 dark:text-gray-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm text-gray-900 dark:text-white mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function AuditTimelineCard({ journal }: { journal: JournalHeaderWithLines }) {
  const timelineEvents = [
    journal.created_at && {
      date: journal.created_at,
      user: journal.created_by_name,
      action: 'Dibuat',
      icon: <FileText className="w-4 h-4" />,
      color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    },
    journal.submitted_at && {
      date: journal.submitted_at,
      user: journal.submitted_by,
      action: 'Dikirim',
      icon: <Send className="w-4 h-4" />,
      color: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
    },
    journal.approved_at && {
      date: journal.approved_at,
      user: journal.approved_by_name,
      action: 'Disetujui',
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    },
    journal.posted_at && {
      date: journal.posted_at,
      user: journal.posted_by_name,
      action: 'Diposting',
      icon: <Banknote className="w-4 h-4" />,
      color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    },
    journal.rejected_at && {
      date: journal.rejected_at,
      user: journal.rejected_by,
      action: 'Ditolak',
      icon: <XCircle className="w-4 h-4" />,
      color: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    },
  ].filter(Boolean) as Array<{
    date: string
    user?: string
    action: string
    icon: React.ReactNode
    color: string
  }>

  // Sort by date descending
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Riwayat Aktivitas
        </h3>
      </div>
      <div className="p-4">
        {timelineEvents.length > 0 ? (
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            
            <div className="space-y-4">
              {timelineEvents.map((event, index) => (
                <div key={index} className="relative flex gap-3">
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${event.color}`}>
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{event.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateShort(event.date)}</p>
                    {event.user && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">oleh {event.user}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Belum ada aktivitas</p>
        )}
      </div>
    </div>
  )
}

function ActionButtonsCard({
  canSubmit,
  canApprove,
  canReject,
  canPost,
  canReverse,
  mutating,
  handleSubmit,
  handleApprove,
  handlePost,
  setShowRejectModal,
  setShowReverseModal,
}: {
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canPost: boolean
  canReverse: boolean
  mutating: boolean
  handleSubmit: () => Promise<void>
  handleApprove: () => Promise<void>
  handlePost: () => Promise<void>
  setShowRejectModal: (show: boolean) => void
  setShowReverseModal: (show: boolean) => void
}) {
  const hasActions = canSubmit || canApprove || canReject || canPost || canReverse
  
  if (!hasActions) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white">Aksi</h3>
      </div>
      <div className="p-4 space-y-3">
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
            <span className="font-medium">Kirim untuk Persetujuan</span>
          </button>
        )}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle size={18} />
            <span className="font-medium">Setujui</span>
          </button>
        )}
        {canReject && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle size={18} />
            <span className="font-medium">Tolak</span>
          </button>
        )}
        {canPost && (
          <button
            onClick={handlePost}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Banknote size={18} />
            <span className="font-medium">Posting ke GL</span>
          </button>
        )}
        {canReverse && (
          <button
            onClick={() => setShowReverseModal(true)}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-orange-600 dark:bg-orange-500 text-white rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw size={18} />
            <span className="font-medium">Balikkan Jurnal</span>
          </button>
        )}
      </div>
    </div>
  )
}

// Utility function for balance calculation
function calculateBalance(lines: { debit_amount?: number; credit_amount?: number }[]): {
  total_debit: number
  total_credit: number
  balance: number
  is_balanced: boolean
} {
  const total_debit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0)
  const total_credit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0)
  const balance = total_debit - total_credit
  const is_balanced = Math.abs(balance) < 0.01
  
  return {
    total_debit,
    total_credit,
    balance,
    is_balanced,
  }
}

