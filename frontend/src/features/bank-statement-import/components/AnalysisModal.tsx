import { useState } from 'react'
import ReactDOM from 'react-dom'
import {
  AlertTriangle,
  XCircle,
  Loader2,
  Upload,
  FileCheck,
  Eye,
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

type TabType = 'summary' | 'preview' | 'warnings'

interface AnalysisModalProps {
  result: BankStatementAnalysisResult | null
  onConfirm: (skipDuplicates: boolean) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function AnalysisModal({
  result,
  onConfirm,
  onCancel,
  isLoading,
}: AnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [skipDuplicates, setSkipDuplicates] = useState(false)

  if (!result) return null

  const { import: imp, summary, stats, warnings: resultWarnings, duplicates: resultDuplicates } = result

  // Use summary or stats for data
  const total_rows = summary?.total_statements || stats?.total_rows || 0
  const valid_rows = stats?.valid_rows || 0
  // Calculate invalid from total - valid - duplicate
  const duplicateCount = stats?.duplicate_rows || resultDuplicates?.length || 0
  const invalid_rows = stats?.invalid_rows || 0
  
  // Calculate pending (rows that are not valid and not invalid)
  const pendingCount = total_rows - valid_rows - invalid_rows
  
  // For preview, use summary.preview
  const preview = summary?.preview || []
  const warnings = resultWarnings || []

  // Calculate percentages
  const validPercentage = total_rows > 0 ? Math.round((valid_rows / total_rows) * 100) : 0

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const modalContent = (
    <div className="modal modal-open backdrop-blur-sm bg-black/40">
      <div className="modal-box max-w-5xl bg-white dark:bg-gray-900 rounded-3xl p-0 shadow-2xl overflow-hidden">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-50 flex items-center justify-center">
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
                onClick={onCancel}
                disabled={isLoading}
                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-colors"
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
                    {imp.file_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {formatFileSize(imp.file_size || 0)}
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

              <div className="flex-1 w-full md:max-w-md">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-500 font-medium">Kualitas Data</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{validPercentage}% Valid</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden flex shadow-inner">
                  <div 
                    className="bg-linear-to-r from-emerald-400 to-emerald-500 h-full transition-all duration-700" 
                    style={{ width: `${validPercentage}%` }} 
                    title={`Valid: ${validPercentage}%`}
                  />
                  <div 
                    className="bg-linear-to-r from-amber-400 to-amber-500 h-full transition-all duration-700" 
                    style={{ width: `${(pendingCount / total_rows) * 100}%` }} 
                    title={`Pending: ${Math.round((pendingCount / total_rows) * 100)}%`}
                  />
                  <div 
                    className="bg-linear-to-r from-rose-400 to-rose-500 h-full transition-all duration-700" 
                    style={{ width: `${(invalid_rows / total_rows) * 100}%` }} 
                    title={`Invalid: ${Math.round((invalid_rows / total_rows) * 100)}%`}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{valid_rows.toLocaleString()} valid</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{pendingCount.toLocaleString()} pending</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">{invalid_rows.toLocaleString()} invalid</span>
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
        <div className="p-6 bg-white dark:bg-gray-900">
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
            <button
              className={`
                px-5 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap
                ${activeTab === 'preview' 
                  ? 'bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
              onClick={() => setActiveTab('preview')}
            >
                <Eye className="w-4 h-4" />
                Preview Data
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
            {activeTab === 'preview' && <AnalysisPreview previewData={preview} validRows={valid_rows} />}
            {activeTab === 'warnings' && <AnalysisWarnings warnings={warnings} duplicateCount={duplicateCount} />}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/95 dark:bg-gray-800/95 border-t border-gray-100 dark:border-gray-800 p-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  disabled={isLoading || duplicateCount === 0}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-gray-300 bg-white checked:border-blue-600 checked:bg-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700"
                />
                <CheckCircle2 
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white opacity-0 transition-opacity peer-checked:opacity-100" 
                />
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${duplicateCount === 0 ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                  Lewati Data Duplikat
                </span>
                {duplicateCount > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {duplicateCount.toLocaleString()} baris akan dilewati
                  </span>
                )}
              </div>
            </label>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm flex-1 sm:flex-none"
                onClick={onCancel}
                disabled={isLoading}
              >
                Batal
              </button>
              
              {skipDuplicates ? (
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 active:scale-95 flex-1 sm:flex-none"
                  disabled={isLoading}
                  onClick={() => onConfirm(true)}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  {isLoading ? 'Memproses...' : 'Import & Lewati Duplikat'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 active:scale-95 flex-1 sm:flex-none"
                  disabled={isLoading}
                  onClick={() => onConfirm(false)}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isLoading ? 'Memproses...' : 'Import Semua Data'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40 backdrop-blur-sm" onClick={onCancel} />
    </div>
  )

  return ReactDOM.createPortal(modalContent, document.body)
}

