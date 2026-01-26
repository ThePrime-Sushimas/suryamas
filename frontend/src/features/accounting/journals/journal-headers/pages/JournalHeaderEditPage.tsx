import { useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  ArrowLeft, Edit, Clock, XCircle, AlertCircle, 
  Calendar, FileText, Banknote, Building2, Tag
} from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderForm } from '../components/JournalHeaderForm'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import type { UpdateJournalDto } from '../types/journal-header.types'
import { formatDateShort } from '../../shared/journal.utils'
import { JournalStatusBadge } from '../components/JournalStatusBadge'
import { JournalTypeBadge } from '../components/JournalTypeBadge'

export function JournalHeaderEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const { selectedJournal, loading, fetchJournalById, updateJournal } = useJournalHeadersStore()

  useEffect(() => {
    if (id) {
      fetchJournalById(id)
    }
  }, [id, fetchJournalById])

  const handleSubmit = useCallback(async (dto: UpdateJournalDto) => {
    if (id) {
      await updateJournal(id, dto)
      navigate('/accounting/journals')
    }
  }, [id, updateJournal, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/journals')
  }, [navigate])

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Memuat data jurnal...</p>
        </div>
      </div>
    )
  }

  // Permission Denied State
  if (!permissions.canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Anda tidak memiliki izin untuk mengedit jurnal ini.</p>
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

  // Journal Not Found State
  if (!selectedJournal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Jurnal Tidak Ditemukan</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Jurnal yang Anda cari tidak ada atau telah dihapus.</p>
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

  // Cannot Edit (Status bukan DRAFT)
  if (selectedJournal.status !== 'DRAFT') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Tidak Dapat Diedit</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">Jurnal dengan status <span className="font-semibold">{selectedJournal.status}</span> tidak dapat diedit.</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">Hanya jurnal dengan status DRAFT yang dapat diubah.</p>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-gray-800 border-b sticky top-0 z-40">
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
                <span className="text-gray-900 dark:text-white font-medium">Edit</span>
              </nav>
            </div>

            {/* Page Title */}
            <div className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white hidden sm:inline">
                Edit Jurnal
              </span>
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

              {/* Edit Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Mode Edit</span>
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
                    {new Intl.NumberFormat('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(selectedJournal.total_debit || 0)} {selectedJournal.currency || 'IDR'}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Formulir Edit Jurnal
            </h2>
          </div>
          <div className="p-6">
            <JournalHeaderForm
              initialData={selectedJournal}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-300">Petunjuk Pengeditan</h3>
              <ul className="text-blue-700 dark:text-blue-400 text-sm mt-1 space-y-1">
                <li>• Pastikan total debit sama dengan total credit sebelum menyimpan</li>
                <li>• Minimal harus ada 2 baris jurnal</li>
                <li>• Tekan Ctrl+Enter untuk submit cepat, Esc untuk cancel</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// Helper Component
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

