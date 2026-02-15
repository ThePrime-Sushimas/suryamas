import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, FileText, Check, X, Loader2, ExternalLink, Clock } from 'lucide-react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context'

interface PosImport {
  id: string
  file_name: string
  status: string
  import_date: string
  date_range_start: string
  date_range_end: string
  total_rows: number
  new_rows: number
  duplicate_rows: number
}

interface GenerateFromImportModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerated: () => void
}

export const GenerateFromImportModal: React.FC<GenerateFromImportModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
}) => {
  const navigate = useNavigate()
  const toast = useToast()
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  const { generateFromImportWithJob } = usePosAggregatesStore()
  
  const [imports, setImports] = useState<PosImport[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Track polling jobs
  const pollingJobs = useRef<Map<string, string>>(new Map()) // jobId -> importId

  const fetchImports = useCallback(async () => {
    setLoading(true)
    try {
      // Import API from pos-imports
      const { posImportsApi } = await import('../../pos-imports/api/pos-imports.api')
      // Use list method with status=IMPORTED filter
      const response = await posImportsApi.list({ status: 'IMPORTED' })
      // Map the response to PosImport interface
      const importedOnly = response.data.filter((imp: PosImport) => imp.status === 'IMPORTED')
      setImports(importedOnly)
    } catch (error) {
      console.error('Failed to fetch imports:', error)
      toast.error('Gagal mengambil data import')
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Fetch imports on open
  useEffect(() => {
    if (isOpen) {
      fetchImports()
    }
  }, [isOpen, fetchImports])

  // Cleanup polling on unmount
  useEffect(() => {
    // Copy ref value to a local variable to avoid stale closure
    const jobsMap = pollingJobs.current
    
    return () => {
      // Clear all polling jobs on unmount
      jobsMap.clear()
    }
  }, [])

  const handleToggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === imports.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(imports.map((imp) => imp.id)))
    }
  }

  // Poll job status
  const pollJobStatus = async (jobId: string, importId: string) => {
    const pollInterval = 2000 // 2 seconds
    const maxAttempts = 120 // 4 minutes max
    let attempts = 0

    // Register this polling job
    pollingJobs.current.set(jobId, importId)

    const poll = async () => {
      // Check if this polling job is still active (not cancelled)
      if (pollingJobs.current.get(jobId) !== importId) {
        return // Job was cancelled
      }

      attempts++
      
      try {
        const { jobsApi } = await import('@/features/jobs/api/jobs.api')
        const job = await jobsApi.getJobById(jobId)
        
        // Update import status based on job progress
        if (job.progress > 0 && job.progress < 100) {
          setImports((prev) =>
            prev.map((imp) =>
              imp.id === importId ? { ...imp, status: 'PROCESSING' } : imp
            )
          )
        }

        if (job.status === 'completed') {
          // Job completed successfully
          pollingJobs.current.delete(jobId)
          setImports((prev) =>
            prev.map((imp) =>
              imp.id === importId ? { ...imp, status: 'MAPPED' } : imp
            )
          )
          
          // Refresh data
          fetchImports()
          onGenerated()
          
          toast.success('Generate completed!')
        } else if (job.status === 'failed') {
          // Job failed
          pollingJobs.current.delete(jobId)
          setImports((prev) =>
            prev.map((imp) =>
              imp.id === importId ? { ...imp, status: 'FAILED' } : imp
            )
          )
          
          toast.error(`Job failed: ${job.error_message || 'Unknown error'}`)
        } else if (attempts < maxAttempts) {
          // Still processing, continue polling
          setTimeout(poll, pollInterval)
        } else {
          // Timeout - stop polling but don't change status
          pollingJobs.current.delete(jobId)
          toast.warning('Job is taking too long. Check status later.')
        }
      } catch (error) {
        console.error('Polling error:', error)
        if (pollingJobs.current.get(jobId) === importId && attempts < maxAttempts) {
          setTimeout(poll, pollInterval)
        } else {
          pollingJobs.current.delete(jobId)
        }
      }
    }

    poll()
  }

  const handleGenerate = async (importId: string) => {
    setGeneratingId(importId)
    try {
      // Create job using jobs system
      const jobId = await generateFromImportWithJob(
        importId,
        currentBranch?.company_id || '',
        currentBranch?.branch_name
      )
      
      toast.success('Job created. Processing in background.')
      
      // Update local state to show processing
      setImports((prev) =>
        prev.map((imp) =>
          imp.id === importId ? { ...imp, status: 'PROCESSING' } : imp
        )
      )

      // Start polling for job status
      pollJobStatus(jobId, importId)
      
      setSelectedIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(importId)
        return newSet
      })
      
      onGenerated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal generate dari import')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleBatchGenerate = async () => {
    for (const importId of selectedIds) {
      await handleGenerate(importId)
    }
  }

  // Render status badge with progress
  const renderStatusBadge = (imp: PosImport) => {
    const isGenerating = generatingId === imp.id
    const isMapped = imp.status === 'MAPPED'
    const isProcessing = imp.status === 'PROCESSING'
    const isFailed = imp.status === 'FAILED'

    if (isMapped) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
          <Check className="w-3 h-3 mr-1" />
          Generated
        </span>
      )
    }
    
    if (isFailed) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
          Failed
        </span>
      )
    }
    
    if (isProcessing || isGenerating) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
          <Clock className="w-3 h-3 mr-1" />
          Processing
        </span>
      )
    }
    
    return (
      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
        {imp.status}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5" />
            Generate dari POS Import
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Memuat data...</span>
            </div>
          ) : imports.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p>Tidak ada file dengan status IMPORTED</p>
              <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">Upload dan confirm file terlebih dahulu</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === imports.length && imports.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pilih Semua ({selectedIds.size}/{imports.length})
                  </span>
                </label>
                <button
                  onClick={handleBatchGenerate}
                  disabled={selectedIds.size === 0 || generatingId !== null}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Generate Terpilih ({selectedIds.size})
                </button>
              </div>

              {/* Import List */}
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date Range</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rows</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {imports.map((imp) => {
                      const isSelected = selectedIds.has(imp.id)
                      const isGenerating = generatingId === imp.id
                      const isMapped = imp.status === 'MAPPED'
                      const isProcessing = imp.status === 'PROCESSING'

                      return (
                        <tr
                          key={imp.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isMapped ? 'bg-green-50 dark:bg-green-900/10' : ''} ${isProcessing ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isMapped || isGenerating || isProcessing}
                              onChange={() => handleToggleSelection(imp.id)}
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{imp.file_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {new Date(imp.date_range_start).toLocaleDateString()} -{' '}
                            {new Date(imp.date_range_end).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {imp.total_rows}
                          </td>
                          <td className="px-4 py-3">
                            {renderStatusBadge(imp)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(isMapped || isProcessing) ? (
                              <span className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400 text-sm">
                                <Check className="w-4 h-4" />
                                {isProcessing ? 'Processing...' : 'Generated'}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleGenerate(imp.id)}
                                disabled={isGenerating}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 ml-auto"
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Creating Job...
                                  </>
                                ) : (
                                  'Generate'
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

{/* Info */}
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>Info:</strong> Transaksi akan di-aggregate berdasarkan tanggal + cabang + metode pembayaran.
                  File yang sudah di-generate akan ditandai sebagai MAPPED.
                  Proses berjalan di background - kamu bisa tutup modal ini dan cek status nanti.
                </p>
              </div>

              {/* Failed Transactions Link */}
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <button
                  onClick={() => navigate('/pos-aggregates/failed-transactions')}
                  className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Lihat Transaksi Gagal</span>
                </button>
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                  Klik untuk melihat transaksi yang gagal diproses.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default GenerateFromImportModal

