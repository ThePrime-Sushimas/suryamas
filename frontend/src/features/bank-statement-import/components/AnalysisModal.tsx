import { useState, useMemo, useEffect, useRef } from 'react'
import { bankStatementImportApi } from '../api/bank-statement-import.api'
import type { BankStatementPreviewRow } from '../types/bank-statement-import.types'
import ReactDOM from 'react-dom'
import {
  AlertTriangle,
  XCircle,
  Loader2,
  FileCheck,
  FileText,
  FileBarChart,
  CheckCircle2,
  BarChart3,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import type { BankStatementAnalysisResult } from '../types/bank-statement-import.types'
import { AnalysisSummary } from './analysis-modal/AnalysisSummary'
import { AnalysisPreview } from './analysis-modal/AnalysisPreview'
import { AnalysisWarnings } from './analysis-modal/AnalysisWarnings'
import { formatFileSize } from '../utils/format'

type TabType = 'summary' | 'preview' | 'warnings'

interface AnalysisModalProps {
  result: BankStatementAnalysisResult | null
  onConfirm: (skipDuplicates: boolean) => Promise<void>
  onCancel: () => void
  error?: string | null
}

export function AnalysisModal({
  result,
  onConfirm,
  onCancel,
  error,
}: AnalysisModalProps) {
const [activeTab, setActiveTab] = useState<TabType>('summary')

const abortControllerRef = useRef<AbortController | null>(null)

const [isProcessing, setIsProcessing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<BankStatementPreviewRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(true)
  
  // ✅ NEW: User-controlled duplicate skipping
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  // Process result data with useMemo before any early returns
  const processedData = useMemo<{ 
    imp: any;
    duplicateCount: number;
    total_rows: number;
    valid_rows: number;
    duplicates: unknown[];
    invalidRows: unknown[];
    warnings: string[];
  }>(() => {
    if (!result) {
      return {
        imp: null,
        duplicateCount: 0,
        total_rows: 0,
        valid_rows: 0,
        duplicates: [],
        invalidRows: [],
        warnings: [],
      }
    }

    const { import: imp, summary, stats, warnings: resultWarnings, duplicates: resultDuplicates, analysis } = result

    // ✅ SIMPLIFIED duplicate: analysis first
    const duplicateCount = analysis?.duplicate_count 
      ?? (analysis?.duplicates?.length || 0)
      ?? (resultDuplicates?.length || 0)
      ?? (summary?.duplicate_count || stats?.duplicate_rows || 0)

    // ✅ FIXED PRIORITY: analysis.* > stats.* > 0
    let total_rows = 0
    let valid_rows = 0  
    
    if (analysis) {
      total_rows = analysis.total_rows || 0
      valid_rows = analysis.valid_rows || 0
    } else if (stats) {
      total_rows = stats.total_rows || 0
      valid_rows = stats.valid_rows || 0
    }
    

    

    const warnings = resultWarnings || []
    
    // Get duplicates and invalid rows for preview
    const duplicates = analysis?.duplicates || resultDuplicates || []
    const invalidRows = analysis?.errors || []
    
    // Get row numbers that are duplicates
    const duplicateRowNumbers = new Set<number>()
    duplicates.forEach((dup: unknown) => {
      const d = dup as { row_numbers?: number[]; row_number?: number }
      if (d.row_numbers && Array.isArray(d.row_numbers)) {
        d.row_numbers.forEach(num => duplicateRowNumbers.add(num))
      } else if (d.row_number) {
        duplicateRowNumbers.add(d.row_number)
      }
    })
    
    // Filter preview to only show valid (non-duplicate) rows

    return {
      imp,
      duplicateCount,
      total_rows,
      valid_rows,
      duplicates,
      invalidRows,
      warnings,
    }
  }, [result])

  // ✅ FIXED: Fetch FULL preview data (not sample) for modal tabs
  useEffect(() => {
    if (!processedData.imp?.id || processedData.total_rows === 0) {
      setPreviewRows([])
      setPreviewLoading(false)
      return
    }
    const controller = new AbortController()
    abortControllerRef.current = controller  // ← simpan ke ref
    
    setPreviewLoading(true)
    bankStatementImportApi.getPreview(processedData.imp.id, processedData.total_rows, controller.signal)
      .then(response => {
        setPreviewRows(response.preview_rows || [])
      })
      .catch(err => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
        console.error('Preview fetch failed:', err)
        setPreviewRows([])
      })
      .finally(() => setPreviewLoading(false))

    return () => controller.abort()
  }, [processedData.imp?.id, processedData.total_rows])

  if (!result) return null

  const { 
    imp, 
    duplicateCount, 
    total_rows, 
    valid_rows,
    duplicates, 
    invalidRows, 
    warnings 
  } = processedData

  // Calculate percentages
  const validPercentage = total_rows > 0 ? Math.round((valid_rows / total_rows) * 100) : 0

// Handle confirm with USER-CONTROLLED duplicate skipping ✅
const handleConfirm = async () => {
    if (duplicateCount > 0 && !skipDuplicates) {
      const confirmed = confirm(
        `⚠️ Ada ${duplicateCount.toLocaleString()} duplikat yang akan menyebabkan import GAGAL.\n\n` +
        `Pastikan Anda sudah menangani duplikat ini sebelum melanjutkan.\n\n` +
        `Lanjutkan?`
      )
      if (!confirmed) return
    }

    setIsProcessing(true)
    setLocalError(null)
    try {
      await onConfirm(skipDuplicates)
      // Modal akan ditutup oleh parent component setelah berhasil
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal memulai import. Silakan coba lagi.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle cancel - always works even during processing
  const handleCancel = () => {
    // Abort preview fetch SEBELUM parent delete import
    abortControllerRef.current?.abort()
    onCancel()
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={handleCancel}
      />
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Loading Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-40 flex items-center justify-center">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full border-4 border-blue-100 dark:border-blue-900/30 animate-pulse"></div>
                <div className="absolute top-0 left-0 w-20 h-20 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
                </div>
              </div>
              <p className="font-bold text-xl text-gray-900 dark:text-white mt-6">Memproses Import...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
                {valid_rows.toLocaleString()} dari {total_rows.toLocaleString()} baris telah diproses
              </p>
              <div className="mt-4 w-48 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-linear-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${validPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">{validPercentage}% Selesai</p>
              
              {/* Cancel button during processing */}
              <button
                onClick={handleCancel}
                className="mt-6 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Tutup & Lihat Progress
              </button>
            </div>
          </div>
        )}

        {/* Header dengan Gradient */}
        <div className="relative overflow-hidden bg-linear-to-br from-blue-600 via-indigo-600 to-purple-700">
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
          </div>

          <div className="relative p-6 pb-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg">
                  <FileBarChart className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-2xl text-white">Konfirmasi Import</h3>
                  <p className="text-sm text-blue-100 dark:text-blue-200 mt-1">
                    Review dan validasi data sebelum import
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-colors z-50 relative"
                title="Tutup"
              >
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>
          
            {/* File Info Card & Progress */}
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-xl flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 flex items-center gap-4 min-w-0">
                <div className="p-3 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate text-lg">
                    {imp?.file_name || '-'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {formatFileSize(imp?.file_size || 0)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {total_rows.toLocaleString()} baris
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {validPercentage}% valid
                    </span>
                  </div>
                </div>
              </div>


            </div>
          </div>
          
          {/* Wave Bottom */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 60V30C240 60 480 0 720 30C960 60 1200 0 1440 30V60H0Z" fill="currentColor" className="text-white dark:text-gray-900" />
            </svg>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          <div className="p-6">
            {/* Error Display */}
            {(localError || error) && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900 dark:text-red-400">Terjadi Kesalahan</h4>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{localError || error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation - Enhanced */}
            <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-1 mb-6 overflow-x-auto scrollbar-thin">
            <button
              className={`
                px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                ${activeTab === 'summary' 
                  ? 'bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
              onClick={() => setActiveTab('summary')}
            >
                <BarChart3 className="w-4 h-4" />
                Ringkasan
            </button>
                
            {(duplicateCount > 0 || (warnings && warnings.length > 0)) && (
              <button
                className={`
                  px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                  ${activeTab === 'warnings' 
                    ? 'bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25' 
                    : 'text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10'
                  }
                `}
                onClick={() => setActiveTab('warnings')}
              >
                <AlertTriangle className="w-4 h-4" />
                Peringatan
                <span className={`
                  text-xs px-2 py-0.5 rounded-full font-bold
                  ${activeTab === 'warnings' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                  }
                `}>
                  {duplicateCount + (warnings?.length || 0)}
                </span>
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {activeTab === 'summary' && <AnalysisSummary result={result} />}
{activeTab === 'preview' && (
              <AnalysisPreview 
                previewData={previewRows.filter(row => row.is_valid)}
                totalImportableCount={valid_rows - duplicateCount}
                previewLoading={previewLoading}
                duplicates={duplicates}
                invalidRows={invalidRows}
              />
            )}
            {activeTab === 'warnings' && <AnalysisWarnings warnings={warnings} duplicateCount={duplicateCount} />}
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/95 dark:bg-gray-800/95 border-t border-gray-100 dark:border-gray-800 p-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* ✅ DYNAMIC DUPLICATE HANDLING UI */}
            <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-gray-800/50 rounded-xl border">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      {duplicateCount.toLocaleString()} Duplikat Ditemukan
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Transaksi identik sudah ada di database
                    </p>
                  </div>
                </div>
                
                {/* ✅ CHECKBOX CONTROL */}
                <label className="flex items-center gap-3 p-3 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border cursor-pointer hover:shadow-md transition-all group min-w-fit">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    Lewati duplikat otomatis
                  </span>
                  {duplicateCount > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">
                      {duplicateCount.toLocaleString()} baris
                    </span>
                  )}
                </label>
              </div>
              
              {!skipDuplicates && duplicateCount > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Import akan GAGAL jika ada duplikat. Pastikan data sudah dibersihkan.</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                disabled={isProcessing}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex-1 sm:flex-none transition-colors
                  ${isProcessing 
                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                    : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                onClick={handleCancel}
              >
                Batal
              </button>
              
              <button
                  type="button"
                  className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 active:scale-95 flex-1 sm:flex-none"
                  disabled={isProcessing}
                  onClick={handleConfirm}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  {isProcessing ? 'Memproses...' : 'Import & Lewati Duplikat'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modalContent, document.body)
}
