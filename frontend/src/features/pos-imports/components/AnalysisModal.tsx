import { useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import type { AnalyzeResult } from '../types/pos-imports.types'
import { POS_IMPORT_MAX_VISIBLE_DUPLICATES } from '../constants/pos-imports.constants'
import { formatCurrency, formatDateTime } from '../utils/format'
import { useBranchContextStore } from '@/features/branch_context'

interface AnalysisModalProps {
  result: AnalyzeResult | null
  onConfirm: (skipDuplicates: boolean) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export const AnalysisModal = ({ result, onConfirm, onCancel, isLoading }: AnalysisModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  useEffect(() => {
    if (result) {
      closeButtonRef.current?.focus()
    }
  }, [result])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isLoading, onCancel])

  if (!result) return null

  const { analysis, import: importData, summary } = result
  const hasDuplicates = analysis.duplicate_rows > 0

  // Get financial data from backend response
  const totalAmount = summary?.totalAmount ?? 0
  const totalTax = summary?.totalTax ?? 0

  // Date range validation
  const dateWarnings: string[] = []
  const earliestDate = new Date(importData.date_range_start)
  const latestDate = new Date(importData.date_range_end)
  const today = new Date()
  
  if (latestDate > today) {
    dateWarnings.push('Contains future-dated transactions')
  }
  
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  if (earliestDate < threeMonthsAgo) {
    dateWarnings.push('Contains transactions older than 3 months')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import Analysis</h3>
            {currentBranch && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Branch: {currentBranch.branch_name}
              </p>
            )}
          </div>
          <button 
            ref={closeButtonRef}
            onClick={onCancel} 
            disabled={isLoading} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Date Range Warnings */}
          {dateWarnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-300">Date Range Warnings</h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-400 mt-1 list-disc pl-4">
                    {dateWarnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Rows</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analysis.total_rows}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">New Rows</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analysis.new_rows}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{analysis.duplicate_rows}</p>
            </div>
          </div>

          {/* Financial Impact - Show if backend provides data */}
          {(totalAmount > 0 || totalTax > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Tax</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalTax)}</p>
              </div>
            </div>
          )}

          {hasDuplicates ? (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <h4 className="font-medium text-orange-900 dark:text-orange-300 mb-2">Duplicate Transactions Found</h4>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mb-3">
                    {analysis.duplicate_rows} transaction(s) already exist in the system. You can choose to skip them or review manually.
                  </p>
                  
                  {analysis.duplicates.length > 0 && (
                    <div className="mt-3 max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-orange-100 dark:bg-orange-900/30 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">Bill Number</th>
                            <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">Sales Number</th>
                            <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">Sales Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800">
                          {analysis.duplicates.slice(0, POS_IMPORT_MAX_VISIBLE_DUPLICATES).map((dup) => (
                            <tr key={`${dup.bill_number}-${dup.sales_number}-${dup.sales_date}`} className="border-t border-orange-100 dark:border-orange-900/30">
                              <td className="px-2 py-1 text-gray-900 dark:text-white">{dup.bill_number}</td>
                              <td className="px-2 py-1 text-gray-900 dark:text-white">{dup.sales_number}</td>
                              <td className="px-2 py-1 text-gray-900 dark:text-white">{dup.sales_date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {analysis.duplicates.length > POS_IMPORT_MAX_VISIBLE_DUPLICATES && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 text-center">
                          ... and {analysis.duplicates.length - POS_IMPORT_MAX_VISIBLE_DUPLICATES} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-500 shrink-0" size={20} />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-300">No Duplicates Found</h4>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    All {analysis.new_rows} transactions are new and ready to be imported.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">File:</span> {importData.file_name}
              </div>
              <div>
                <span className="font-medium">Date Range:</span> {new Date(importData.date_range_start).toLocaleDateString()} - {new Date(importData.date_range_end).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Uploaded:</span> {formatDateTime(importData.created_at)}
              </div>
              <div>
                <span className="font-medium">By:</span> {importData.created_by || 'System'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          {hasDuplicates && (
            <button
              onClick={() => onConfirm(true)}
              disabled={isLoading}
              className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex flex-col items-start gap-1"
            >
              <div className="flex items-center gap-2">
                {isLoading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>Import {analysis.new_rows} New Rows</span>
              </div>
              <span className="text-xs opacity-90">Skip {analysis.duplicate_rows} duplicates</span>
            </button>
          )}
          <button
            onClick={() => onConfirm(false)}
            disabled={isLoading}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex flex-col items-start gap-1"
          >
            <div className="flex items-center gap-2">
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{hasDuplicates ? `Import All ${analysis.total_rows} Rows` : 'Confirm Import'}</span>
            </div>
            {hasDuplicates && (
              <span className="text-xs opacity-90">May create {analysis.duplicate_rows} duplicates</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
