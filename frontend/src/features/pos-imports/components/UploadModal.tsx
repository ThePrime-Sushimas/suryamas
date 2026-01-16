import { useState, useRef, useEffect } from 'react'
import { Upload, X, AlertCircle } from 'lucide-react'
import { useBranchContextStore } from '@/features/branch_context'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, branchId: string) => Promise<void>
  isLoading: boolean
}

export const UploadModal = ({ isOpen, onClose, onUpload, isLoading }: UploadModalProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  // Listen to upload progress
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const customEvent = e as CustomEvent<number>
      setUploadProgress(customEvent.detail)
    }
    window.addEventListener('upload-progress', handleProgress)
    return () => window.removeEventListener('upload-progress', handleProgress)
  }, [])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please select an Excel file (.xlsx or .xls)')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file || !currentBranch?.branch_id) return

    try {
      setUploadProgress(0)
      await onUpload(file, currentBranch.branch_id)
      setFile(null)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setUploadProgress(0)
      // Error handled by store
    }
  }

  const handleClose = () => {
    setFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Upload POS Data</h3>
          <button onClick={handleClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Excel File <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
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
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Excel files only (max 10MB)
                </p>
              </label>
            </div>
            {file && (
              <div className="mt-2 p-2 bg-blue-50 rounded flex items-center justify-between">
                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                <button
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  disabled={isLoading}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {error && (
              <div className="mt-2 p-2 bg-red-50 rounded flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {uploadProgress === 100 ? 'Processing...' : 'Uploading...'}
                </span>
                <span className="font-medium text-blue-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {uploadProgress === 100 && (
                <p className="text-xs text-gray-500 text-center">
                  Analyzing file for duplicates, please wait...
                </p>
              )}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 font-medium mb-1">Required Columns:</p>
            <ul className="text-xs text-gray-500 space-y-0.5">
              <li>• Bill Number</li>
              <li>• Sales Number</li>
              <li>• Sales Date</li>
              <li>• Gross Sales, Tax, Service, Discount, Net Sales</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
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
    </div>
  )
}
