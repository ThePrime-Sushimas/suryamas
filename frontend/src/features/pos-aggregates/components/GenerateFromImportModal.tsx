import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, FileText, Check, X, Loader2, AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { posAggregatesApi } from '../api/posAggregates.api'
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

interface ImportError {
  source_ref: string
  error: string
}

interface GenerateResult {
  importId: string
  created: number
  skipped: number
  errors: ImportError[]
}

export const GenerateFromImportModal: React.FC<GenerateFromImportModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
}) => {
  const navigate = useNavigate()
  const toast = useToast()
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  
  const [imports, setImports] = useState<PosImport[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [errorsExpanded, setErrorsExpanded] = useState<Record<string, boolean>>({})
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null)

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
      setLastResult(null)
      setErrorsExpanded({})
    }
  }, [isOpen, fetchImports])

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

  const toggleErrorsExpanded = (importId: string) => {
    setErrorsExpanded(prev => ({
      ...prev,
      [importId]: !prev[importId]
    }))
  }

  const handleGenerate = async (importId: string) => {
    setGeneratingId(importId)
    setLastResult(null)
    try {
      const result = await posAggregatesApi.generateFromImport(
        importId,
        currentBranch?.company_id || '',
        currentBranch?.branch_name
      )
      
      // Store result with importId for error display
      setLastResult({
        ...result,
        importId
      })
      
      if (result.created > 0) {
        toast.success(`Berhasil membuat ${result.created} transaksi agregat`)
      }
      if (result.skipped > 0) {
        toast.info(`${result.skipped} transaksi di-skip (sudah ada)`)
      }
      if (result.errors.length > 0) {
        // Show all errors in toast notification
        const errorMessages = result.errors.map(e => `${e.source_ref}: ${e.error}`).join('\n')
        toast.error(`${result.errors.length} transaksi gagal:\n${errorMessages}`, 10000)
        // Expand error section by default when there are errors
        setErrorsExpanded(prev => ({ ...prev, [importId]: true }))
      } else {
        // Collapse errors if no errors
        setErrorsExpanded(prev => ({ ...prev, [importId]: false }))
      }
      
      // Call API to update status to MAPPED
      const { posImportsApi } = await import('../../pos-imports/api/pos-imports.api')
      await posImportsApi.updateStatus(importId, 'MAPPED')
      
      // Update local state - mark as generated
      setImports((prev) =>
        prev.map((imp) =>
          imp.id === importId ? { ...imp, status: 'MAPPED' } : imp
        )
      )

      setSelectedIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(importId)
        return newSet
      })
      
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

  // Render error details section
  const renderErrorDetails = (importId: string, errors: ImportError[]) => {
    const isExpanded = errorsExpanded[importId] || false
    
    if (errors.length === 0) return null
    
    return (
      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleErrorsExpanded(importId)}
          className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {errors.length} Transaksi Gagal
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-red-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-red-600" />
          )}
        </button>
        
        {isExpanded && (
          <div className="p-4 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-100">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-red-700 uppercase">Source Ref</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-red-700 uppercase">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200">
                {errors.map((err, index) => (
                  <tr key={index} className="hover:bg-red-100">
                    <td className="px-3 py-2 text-red-800 font-mono text-xs break-all">
                      {err.source_ref}
                    </td>
                    <td className="px-3 py-2 text-red-700">
                      {err.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Generate dari POS Import
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Memuat data...</span>
            </div>
          ) : imports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Tidak ada file dengan status IMPORTED</p>
              <p className="text-sm mt-1">Upload dan confirm file terlebih dahulu</p>
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
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">
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
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rows</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {imports.map((imp) => {
                      const isSelected = selectedIds.has(imp.id)
                      const isGenerating = generatingId === imp.id
                      const isMapped = imp.status === 'MAPPED'
                      
                      // Get errors for this import from last result
                      const errorsForImport = (lastResult?.importId === imp.id) ? lastResult.errors : []
                      const errorCount = errorsForImport.length || 0

                      return (
                        <React.Fragment key={imp.id}>
                          <tr
                            className={`hover:bg-gray-50 ${isMapped ? 'bg-green-50' : ''} ${errorCount > 0 ? 'bg-red-50' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isMapped || isGenerating}
                                onChange={() => handleToggleSelection(imp.id)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm">{imp.file_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(imp.date_range_start).toLocaleDateString()} -{' '}
                              {new Date(imp.date_range_end).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {imp.total_rows}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  isMapped
                                    ? 'bg-green-100 text-green-800'
                                    : errorCount > 0
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isMapped ? 'MAPPED' : errorCount > 0 ? `ERROR (${errorCount})` : imp.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isMapped ? (
                                <span className="flex items-center justify-end gap-1 text-green-600 text-sm">
                                  <Check className="w-4 h-4" />
                                  Generated
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
                                      Generating...
                                    </>
                                  ) : (
                                    'Generate'
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* Error details row */}
                          {errorCount > 0 && (
                            <tr className="bg-red-50">
                              <td colSpan={6} className="px-4 py-0">
                                {renderErrorDetails(imp.id, errorsForImport)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

{/* Info */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>Info:</strong> Transaksi akan di-aggregate berdasarkan tanggal + cabang + metode pembayaran.
                  File yang sudah di-generate akan ditandai sebagai MAPPED.
                </p>
              </div>

              {/* Failed Transactions Link */}
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <button
                  onClick={() => navigate('/pos-aggregates/failed-transactions')}
                  className="flex items-center gap-2 text-sm text-yellow-700 hover:text-yellow-800"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Lihat Transaksi Gagal</span>
                </button>
                <p className="text-xs text-yellow-600 mt-1">
                  Klik untuk melihat dan memfix transaksi yang gagal diproses.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default GenerateFromImportModal

