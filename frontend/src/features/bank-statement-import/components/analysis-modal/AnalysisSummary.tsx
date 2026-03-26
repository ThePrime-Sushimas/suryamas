import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'
import type { BankStatementAnalysisResult } from '../../types/bank-statement-import.types'

interface AnalysisSummaryProps {
  result: BankStatementAnalysisResult
}

export function AnalysisSummary({ result }: AnalysisSummaryProps) {
  const { analysis, stats } = result

  // ✅ FIXED: analysis.* > stats.* > 0 (consistent with Modal)
  let totalRows = 0
  let validRows = 0
  let invalidRows = 0
  
  if (analysis) {
    totalRows = analysis.total_rows || 0
    validRows = analysis.valid_rows || 0
    invalidRows = analysis.invalid_rows || 0
  } else if (stats) {
    totalRows = stats.total_rows || 0
    validRows = stats.valid_rows || 0
    invalidRows = stats.invalid_rows || 0
  }
  
  const duplicates = analysis?.duplicates || result.duplicates || []
  const duplicateCount = duplicates.length

  // Calculate percentages
  const validPercentage = totalRows > 0 ? Math.round((validRows / totalRows) * 100) : 0
  const duplicatePercentage = totalRows > 0 ? Math.round((duplicateCount / totalRows) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Ringkasan Analisis
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalRows.toLocaleString()} total transaksi
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {validPercentage}%
            </p>
            <p className="text-xs text-gray-500">Valid</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Valid Rows */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Valid</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {validRows.toLocaleString()}
          </p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{validPercentage}% dari total</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${validPercentage}%` }}
              />
            </div>
          </div>
        </div>        

        {/* Duplicates */}
        <div className="bg-amber-50 dark:bg-amber-950/50 rounded-xl p-4 border border-amber-200/50 dark:border-amber-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Duplikat</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {duplicateCount.toLocaleString()}
          </p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{duplicatePercentage}% dari total</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${duplicatePercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-600 dark:text-gray-400">Valid: {validRows.toLocaleString()}</span>
          </span>          
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            <span className="text-gray-600 dark:text-gray-400">Duplikat: {duplicateCount.toLocaleString()}</span>
          </span>           
        </div>
        <div className="text-right">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            Total: {totalRows.toLocaleString()} baris
          </p>
        </div>
      </div>
    </div>
  )
}

// Compact version for smaller spaces
export function AnalysisSummaryCompact({ result }: { result: BankStatementAnalysisResult }) {
  const { analysis, stats } = result
  const totalRows = analysis?.total_rows || stats?.total_rows || 0
  const validRows = analysis?.valid_rows || stats?.valid_rows || 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">Progress</span>
          <span className="font-medium text-blue-600">
            {totalRows > 0 ? Math.round((validRows / totalRows) * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalRows > 0 ? (validRows / totalRows) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {validRows}/{totalRows}
        </p>
        <p className="text-xs text-gray-500">baris valid</p>
      </div>
    </div>
  )
}

