import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, RotateCcw, ListTree, LayoutTemplate, Sparkles, Copy, CheckCircle, BookOpen, FileText } from 'lucide-react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JournalHeaderForm } from '../components/JournalHeaderForm'
import { useJournalPermissions } from '../hooks/useJournalPermissions'
import type { CreateJournalDto, UpdateJournalDto } from '../types/journal-header.types'

interface SuggestedTemplate {
  id: string
  name: string
  description: string
  lines: number
  total_amount: number
}

export function JournalHeaderFormPage() {
  const navigate = useNavigate()
  const permissions = useJournalPermissions()
  const { createJournal } = useJournalHeadersStore()
  const [showTemplates, setShowTemplates] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)

  // Mock suggested templates - in real app this would come from API
  const suggestedTemplates: SuggestedTemplate[] = [
    {
      id: '1',
      name: 'Biaya Bulanan',
      description: 'Biaya rutin bulanan seperti listrik, air, telepon',
      lines: 3,
      total_amount: 2500000,
    },
    {
      id: '2',
      name: 'Pembelian Persediaan',
      description: 'Pembelian barang dagangan dari supplier',
      lines: 5,
      total_amount: 15000000,
    },
    {
      id: '3',
      name: 'Penjualan Tunai',
      description: 'Penjualan barang dengan pembayaran tunai',
      lines: 2,
      total_amount: 5000000,
    },
  ]

  const handleSubmit = useCallback(async (dto: CreateJournalDto | UpdateJournalDto) => {
    await createJournal(dto as CreateJournalDto)
    navigate('/accounting/journals')
  }, [createJournal, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/journals')
  }, [navigate])

  const handleUseTemplate = (template: SuggestedTemplate) => {
    // In real implementation, this would pre-fill the form
    alert(`Template "${template.name}" dipilih. Form akan di-prefill dengan data template.`)
    setShowTemplates(false)
  }

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Buat Journal Entry
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Buat entri journal manual baru
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                showTemplates
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </button>
            
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                showQuickActions
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Quick Actions
            </button>
          </div>
        </div>

        {/* Template Suggestions */}
        {showTemplates && suggestedTemplates.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Template yang Disarankan</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Pilih template untuk mempercepat pembuatan journal
              </p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestedTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all group"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {template.description}
                      </p>
                    </div>
                    <Copy className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                      {template.lines} baris
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                      {template.total_amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Quick Actions & Validation */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            {showQuickActions && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => navigate('/accounting/journals/new?type=recurring')}
                    className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-600 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800">
                        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
                          Recurring Entry
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Biaya rutin, penyusutan, dll.
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/accounting/journals/new?type=reversal')}
                    className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-600 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-amber-100 dark:bg-amber-900/50 rounded-lg group-hover:bg-amber-200 dark:group-hover:bg-amber-800">
                        <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300">
                          Reversal Entry
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Balikan journal yang ada
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/accounting/chart-of-accounts')}
                    className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-600 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-green-100 dark:bg-green-900/50 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800">
                        <ListTree className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-300">
                          Lihat COA
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Chart of Accounts
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

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
                    Gunakan template atau buat journal manual. Pastikan total debit = total credit sebelum menyimpan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Form */}
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
        </div>
      </div>
    </div>
  )
}

