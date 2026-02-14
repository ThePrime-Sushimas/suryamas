import { useState, useRef } from 'react'
import { Upload, X, AlertCircle } from 'lucide-react'
import { useBranchContextStore } from '@/features/branch_context'
import { POS_IMPORT_MAX_FILE_SIZE_BYTES, POS_IMPORT_MAX_FILE_SIZE_MB } from '../constants/pos-imports.constants'
import { ConfirmModal } from './ConfirmModal'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, branchId: string) => Promise<void>
  isLoading: boolean
  uploadProgress: number
}

export const UploadModal = ({ isOpen, onClose, onUpload, isLoading, uploadProgress }: UploadModalProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please select an Excel file (.xlsx or .xls)')
      return
    }

    if (selectedFile.size > POS_IMPORT_MAX_FILE_SIZE_BYTES) {
      setError(`File size must be less than ${POS_IMPORT_MAX_FILE_SIZE_MB}MB`)
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file || !currentBranch?.branch_id) return

    try {
      await onUpload(file, currentBranch.branch_id)
      setFile(null)
      setError(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed')
    }
  }

  const handleClose = () => {
    if (isLoading && uploadProgress < 100) {
      setShowCloseConfirm(true)
      return
    }
    setFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const confirmClose = () => {
    setShowCloseConfirm(false)
    setFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload POS Data</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Excel File <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isLoading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Excel files only (max {POS_IMPORT_MAX_FILE_SIZE_MB}MB)
                </p>
              </label>
            </div>
            {file && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                <button
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  disabled={isLoading}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {error && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {uploadProgress === 100 ? 'Analyzing...' : 'Uploading...'}
                </span>
                <div className="text-right">
                  <div className="font-medium text-blue-600 dark:text-blue-400">{uploadProgress}%</div>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <div className="font-medium">File Size</div>
                  <div>{((file?.size || 0) / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div>
                  <div className="font-medium">Type</div>
                  <div>{file?.name.split('.').pop()?.toUpperCase() || 'N/A'}</div>
                </div>
                <div>
                  <div className="font-medium">Branch</div>
                  <div className="truncate" title={currentBranch?.branch_name}>
                    {currentBranch?.branch_name || 'Unknown'}
                  </div>
                </div>
              </div>
              
              {uploadProgress === 100 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Analyzing {file?.name} for duplicates and validation...
                </p>
              )}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Required Columns:</p>
            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
              <li>• Bill Number</li>
              <li>• Sales Number</li>
              <li>• Sales Date</li>
              <li>• Gross Sales, Tax, Service, Discount, Net Sales</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {isLoading ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isLoading}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Upload & Analyze
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showCloseConfirm}
        title="Upload in Progress"
        message="Upload is in progress. Are you sure you want to close? The upload will continue in the background."
        confirmText="Close Anyway"
        onConfirm={confirmClose}
        onCancel={() => setShowCloseConfirm(false)}
        variant="warning"
      />
    </div>
  )
}
