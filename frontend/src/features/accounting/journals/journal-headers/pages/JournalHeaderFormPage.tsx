import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, BookOpen, FileText } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderForm } from '../components/JournalHeaderForm'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import type { CreateJournalDto, UpdateJournalDto } from '../types/journal-header.types'

// interface SuggestedTemplate {
  //   id: string
  //   name: string
  //   description: string
  //   lines: number
  //   total_amount: number
  // }

export function JournalHeaderFormPage() {
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const { createJournal } = useJournalHeadersStore()
  // const [showTemplates, setShowTemplates] = useState(false)
  // Quick actions removed per user request

  // Mock suggested templates - in real app this would come from API
  // const suggestedTemplates: SuggestedTemplate[] = [
  //   {
  //     id: '1',
  //     name: 'Biaya Bulanan',
  //     description: 'Biaya rutin bulanan seperti listrik, air, telepon',
  //     lines: 3,
  //     total_amount: 2500000,
  //   },
  //   {
  //     id: '2',
  //     name: 'Pembelian Persediaan',
  //     description: 'Pembelian barang dagangan dari supplier',
  //     lines: 5,
  //     total_amount: 15000000,
  //   },
  //   {
  //     id: '3',
  //     name: 'Penjualan Tunai',
  //     description: 'Penjualan barang dengan pembayaran tunai',
  //     lines: 2,
  //     total_amount: 5000000,
  //   },
  // ]

  const handleSubmit = useCallback(async (dto: CreateJournalDto | UpdateJournalDto) => {
    await createJournal(dto as CreateJournalDto)
    navigate('/accounting/journals')
  }, [createJournal, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/journals')
  }, [navigate])

  // const handleUseTemplate = (template: SuggestedTemplate) => {
  //   // In real implementation, this would pre-fill the form
  //   alert(`Template "${template.name}" dipilih. Form akan di-prefill dengan data template.`)
  //   setShowTemplates(false)
  // }

  if (!permissions.canCreate) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-800 rounded-lg">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Akses Ditolak</h3>
              <p className="text-sm text-red-600 dark:text-red-400">Anda tidak memiliki izin untuk membuat journal</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/accounting/journals')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[95vw] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Accounting / Jurnal / Buat
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Buat Journal Entry
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Buat entri journal manual baru
            </p>
          </div>
          
          <div className="flex items-center gap-3">

            
          </div>
        </div>


        {/* Template Suggestions */}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form - Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Form Journal</h3>
                </div>
              </div>
              <div className="p-6">
                <JournalHeaderForm 
                  onSubmit={handleSubmit} 
                  onCancel={handleCancel}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - Rules & Help */}
          <div className="space-y-6 lg:col-span-1">
            {/* Validation Rules */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Aturan Validasi</h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 flex items-center justify-center bg-green-100 dark:bg-green-900/50 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Debit harus sama dengan Credit
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 flex items-center justify-center bg-green-100 dark:bg-green-900/50 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Minimal 2 baris diperlukan
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 flex items-center justify-center bg-green-100 dark:bg-green-900/50 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Akun yang valid diperlukan
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 flex items-center justify-center bg-green-100 dark:bg-green-900/50 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    Tanggal harus dalam periode aktif
                  </span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Panduan</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Buat journal manual. Pastikan total debit = total credit sebelum menyimpan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

