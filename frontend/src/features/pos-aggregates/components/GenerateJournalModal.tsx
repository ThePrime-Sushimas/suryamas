/**
 * GenerateJournalModal.tsx
 * 
 * Modal component for generating journal entries from aggregated transactions.
 * Features:
 * - Jobs system integration for background processing
 * - Progress tracking with polling
 * - Filter configuration (date range, branch, payment method)
 * - Real-time status updates
 * - Success/error result display
 */

import React, { useState, useEffect, useRef } from 'react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useBranchesStore } from '@/features/branches/store/branches.store'
import { usePaymentMethodsStore } from '@/features/payment-methods/store/paymentMethods.store'
import { X, FileText, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import type { GenerateJournalDto } from '../types'

// =============================================================================
// TYPES
// =============================================================================

interface GenerateJournalModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ProgressState {
  current: number
  total: number
  phase: string
  message: string
}

interface GenerationResult {
  success: boolean
  jobId?: string
  journals_created: number
  transactions_processed: number
  failed_count: number
  duration_ms: number
}

// =============================================================================
// COMPONENT
// =============================================================================

export const GenerateJournalModal: React.FC<GenerateJournalModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Stores
  const { filter, fetchTransactions, fetchSummary, generateJournalWithJob, isMutating } = usePosAggregatesStore()
  const { branches, fetchBranches } = useBranchesStore()
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore()

  // Modal state
  const [step, setStep] = useState<'config' | 'processing' | 'result'>('config')
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  
  // Job tracking
  const [jobId, setJobId] = useState<string | null>(null)
  const pollingJobs = useRef<Map<string, boolean>>(new Map())

  // Form state
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<number | ''>('')
  const [includeUnreconciledOnly, setIncludeUnreconciledOnly] = useState<boolean>(true)

  // Fetch data on mount
  useEffect(() => {
    if (isOpen) {
      fetchBranches(1, 100)
      fetchPaymentMethods(1, 100)
      
      // Initialize dates from filter or default to current month
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      
      setDateFrom(filter.transaction_date_from || firstDay.toISOString().split('T')[0])
      setDateTo(filter.transaction_date_to || today.toISOString().split('T')[0])
      setSelectedBranch(filter.branch_name || '')
      setSelectedPaymentMethod(filter.payment_method_id || '')
    }
  }, [isOpen, fetchBranches, fetchPaymentMethods, filter])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('config')
      setProgress(null)
      setResult(null)
      setLocalError(null)
      setJobId(null)
    }
  }, [isOpen])

  // Cleanup polling on unmount
  useEffect(() => {
    // Copy ref value to a local variable to avoid stale closure
    const jobsMap = pollingJobs.current
    
    return () => {
      // Clear all polling jobs on unmount
      jobsMap.forEach((_, id) => {
        jobsMap.delete(id)
      })
    }
  }, [])

  // Poll job status
  const pollJobStatus = async (id: string) => {
    const pollInterval = 2000 // 2 seconds
    const maxAttempts = 120 // 4 minutes max
    let attempts = 0

    // Register this polling job
    pollingJobs.current.set(id, true)

    const poll = async () => {
      if (!pollingJobs.current.get(id)) return

      attempts++
      
      try {
        const { jobsApi } = await import('@/features/jobs/api/jobs.api')
        const job = await jobsApi.getJobById(id)
        
        // Update progress
        if (job.progress > 0 && job.progress < 100) {
          setProgress({
            current: job.progress,
            total: 100,
            phase: 'processing',
            message: 'Processing...'
          })
        }

        if (job.status === 'completed') {
          // Job completed successfully
          pollingJobs.current.delete(id)
          setProgress({
            current: 100,
            total: 100,
            phase: 'complete',
            message: 'Selesai!'
          })
          
          setResult({
            success: true,
            jobId: id,
            journals_created: 0, // Will be updated via metadata
            transactions_processed: 0,
            failed_count: 0,
            duration_ms: 0,
          })

          // Refresh data
          await Promise.all([
            fetchTransactions(1),
            fetchSummary(),
          ])

          setStep('result')
        } else if (job.status === 'failed') {
          // Job failed
          pollingJobs.current.delete(id)
          setProgress({
            current: 0,
            total: 100,
            phase: 'failed',
            message: 'Failed'
          })
          
          setResult({
            success: false,
            jobId: id,
            journals_created: 0,
            transactions_processed: 0,
            failed_count: 1,
            duration_ms: 0,
          })
          
          setLocalError(job.error_message || 'Unknown error')
          setStep('result')
        } else if (attempts < maxAttempts) {
          // Still processing, continue polling
          setTimeout(poll, pollInterval)
        } else {
          // Timeout
          pollingJobs.current.delete(id)
          setProgress({
            current: progress?.current || 0,
            total: 100,
            phase: 'timeout',
            message: 'Timeout - check status later'
          })
        }
      } catch (error) {
        console.error('Polling error:', error)
        if (pollingJobs.current.get(id) && attempts < maxAttempts) {
          setTimeout(poll, pollInterval)
        } else {
          pollingJobs.current.delete(id)
        }
      }
    }

    poll()
  }

  // Handle generate journal with jobs
  const handleGenerate = async () => {
    setStep('processing')
    setLocalError(null)
    setJobId(null)

    try {
      const dto: GenerateJournalDto = {
        transaction_date_from: dateFrom,
        transaction_date_to: dateTo,
        branch_name: selectedBranch || undefined,
        payment_method_id: selectedPaymentMethod || undefined,
        include_unreconciled_only: includeUnreconciledOnly,
      }

      // Set initial progress
      setProgress({
        current: 5,
        total: 100,
        phase: 'processing',
        message: 'Creating job...'
      })

      // Create job using jobs system
      const newJobId = await generateJournalWithJob(dto)
      setJobId(newJobId)

      toast.success('Job created. Processing in background.')

      // Start polling for job status
      setProgress({
        current: 10,
        total: 100,
        phase: 'processing',
        message: 'Processing...'
      })
      
      pollJobStatus(newJobId)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
      setLocalError(errorMessage)
      
      setResult({
        success: false,
        journals_created: 0,
        transactions_processed: 0,
        failed_count: 1,
        duration_ms: 0,
      })
      
      setStep('result')
    }
  }

  // Handle close
  const handleClose = () => {
    // Cancel any ongoing polling
    if (jobId) {
      pollingJobs.current.delete(jobId)
    }
    
    setStep('config')
    setProgress(null)
    setResult(null)
    setLocalError(null)
    setJobId(null)
    onClose()
  }

  // Simple toast for success messages
  const toast = {
    success: (msg: string) => {
      console.log('Toast success:', msg)
    },
    error: (msg: string) => {
      console.error('Toast error:', msg)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generate Jurnal dari Transaksi
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Buat entri jurnal dari transaksi POS (berjalan di background)
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {step === 'config' && (
              <div className="space-y-4">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      min={dateFrom}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Branch Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cabang (Kosongkan untuk semua)
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Semua Cabang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.branch_name}>
                        {branch.branch_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Metode Pembayaran (Kosongkan untuk semua)
                  </label>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Semua Metode Pembayaran</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Options */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="unreconciledOnly"
                    checked={includeUnreconciledOnly}
                    onChange={(e) => setIncludeUnreconciledOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="unreconciledOnly" className="text-sm text-gray-700 dark:text-gray-300">
                    Hanya transaksi yang belum memiliki jurnal
                  </label>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        Proses ini akan berjalan di background.
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        Kamu bisa tutup modal ini dan cek status job di menu Jobs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="py-8">
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {progress?.phase === 'complete' ? 'Selesai' : 'Memproses...'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {progress?.current.toFixed(0) || 0}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress?.current || 0}%` }}
                    />
                  </div>
                </div>

                {/* Status Message */}
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-3" />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
                    {progress?.message || 'Memproses...'}
                  </p>
                  {jobId && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Job ID: {jobId.slice(0, 8)}...
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Proses berjalan di background. Tutup modal ini untuk melanjutkan pekerjaan lain.
                  </p>
                </div>

                {/* Error Display */}
                {localError && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">{localError}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'result' && result && (
              <div className="py-4">
                {result.success ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Job Berhasil Dibuat!
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Jurnal sedang diproses di background.
                      {jobId && (
                        <span className="block text-sm text-gray-500 dark:text-gray-500 mt-1">
                          Job ID: {jobId}
                        </span>
                      )}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">Processing</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Job ID</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
                          {jobId?.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Aksi</p>
                        <button
                          onClick={() => navigate('/jobs')}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                        >
                          Lihat di Jobs
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Job Gagal
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {localError || 'Terjadi kesalahan saat memproses job'}
                    </p>

                    {/* Error Details */}
                    {localError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left">
                        <p className="text-sm font-medium text-red-800 dark:text-red-400">Detail Error:</p>
                        <p className="text-sm text-red-700 dark:text-red-500">{localError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex justify-end gap-3">
            {step === 'config' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isMutating || !dateFrom || !dateTo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  {isMutating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Membuat Job...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Buat Job
                    </>
                  )}
                </button>
              </>
            )}

            {step === 'processing' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
              >
                Tutup
              </button>
            )}

            {step === 'result' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Add navigate import
const navigate = (path: string) => {
  window.location.href = path
}

export default GenerateJournalModal

