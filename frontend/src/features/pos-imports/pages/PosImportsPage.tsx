import { useEffect, useState } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { usePosImportsStore } from '../store/pos-imports.store'
import { UploadModal } from '../components/UploadModal'
import { AnalysisModal } from '../components/AnalysisModal'
import { PosImportsTable } from '../components/PosImportsTable'
import { useBranchContextStore } from '@/features/branch_context'

export const PosImportsPage = () => {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  
  const {
    imports,
    analyzeResult,
    loading,
    error,
    fetchImports,
    uploadFile,
    confirmImport,
    deleteImport,
    clearAnalyzeResult,
    clearError
  } = usePosImportsStore()

  useEffect(() => {
    if (currentBranch?.company_id) {
      fetchImports()
    }
  }, [currentBranch?.company_id, fetchImports])

  const handleUpload = async (file: File, branchId: string) => {
    try {
      await uploadFile(file, branchId)
      setShowUploadModal(false)
    } catch {
      // Error handled by store
    }
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    if (!analyzeResult?.import.id) return
    
    try {
      await confirmImport(analyzeResult.import.id, skipDuplicates)
      clearAnalyzeResult()
      // Refresh list after successful import
      await fetchImports()
    } catch {
      // Error handled by store
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this import?')) return
    await deleteImport(id)
  }

  if (!currentBranch?.company_id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900">Branch Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Please select a branch to manage POS imports
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Imports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Import and manage POS transaction data from Excel files
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload size={20} />
          Upload Excel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {loading.list ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-2 text-sm text-gray-600">Loading imports...</p>
          </div>
        ) : (
          <PosImportsTable
            imports={imports}
            onDelete={handleDelete}
            isLoading={loading.delete}
          />
        )}
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        isLoading={loading.upload}
      />

      <AnalysisModal
        result={analyzeResult}
        onConfirm={handleConfirm}
        onCancel={clearAnalyzeResult}
        isLoading={loading.confirm}
      />
    </div>
  )
}
