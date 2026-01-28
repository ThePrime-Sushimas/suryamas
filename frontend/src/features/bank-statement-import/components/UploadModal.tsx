import { useState, useRef } from 'react'
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, bankAccountId: string) => Promise<void>
  isLoading: boolean
  uploadProgress: number
}

export function UploadModal({
  isOpen,
  onClose,
  onUpload,
  isLoading,
  uploadProgress,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [bankAccountId, setBankAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (f: File | null) => {
    if (!f) {
      setFile(null)
      return
    }

    // Validasi basic: Excel & CSV, max 50MB
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ]
    const allowedExtensions = ['.xlsx', '.xls', '.csv']
    const fileExtension = '.' + f.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(f.type) && !allowedExtensions.includes(fileExtension)) {
      setError('File harus berupa Excel (.xlsx, .xls) atau CSV (.csv)')
      setFile(null)
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('Ukuran file maksimal 50MB')
      setFile(null)
      return
    }
    if (f.size === 0) {
      setError('File tidak boleh kosong')
      setFile(null)
      return
    }

    setError(null)
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    handleFileChange(droppedFile)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleSubmit = async () => {
    if (!file || !bankAccountId) {
      setError('Pilih file dan akun bank terlebih dahulu')
      return
    }

    try {
      await onUpload(file, bankAccountId)
      setFile(null)
      setBankAccountId('')
      setError(null)
      onClose()
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Gagal mengupload file')
      }
    }
  }

  const removeFile = () => {
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload Bank Statement
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload file Excel mutasi bank untuk dianalisis sebelum diimport.
        </p>

        <div className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Akun Bank</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Masukkan Bank Account ID"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">File Excel / CSV</span>
            </label>
            
            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  disabled={isLoading}
                />
                <FileSpreadsheet className={`w-12 h-12 mx-auto mb-3 ${
                  isDragOver ? 'text-blue-500' : 'text-gray-400'
                }`} />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {isDragOver ? 'Lepaskan file di sini' : 'Klik atau seret file ke sini'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Mendukung .xlsx, .xls, .csv (Max 50MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={removeFile}
                  disabled={isLoading}
                  className="btn btn-sm btn-ghost btn-circle text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="w-full">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Mengupload...</span>
                <span className="font-medium text-blue-600">{uploadProgress}%</span>
              </div>
              <progress
                className="progress progress-primary w-full h-2"
                value={uploadProgress}
                max={100}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="modal-action mt-6">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !file || !bankAccountId}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengupload...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Upload & Analisis
              </>
            )}
          </button>
        </div>
      </div>
      <div 
        className="modal-backdrop" 
        onClick={onClose}
      />
    </div>
  )
}

