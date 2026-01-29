import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X, CheckCircle, Loader2 } from 'lucide-react'
import { bankAccountsApi } from '../../bank-accounts/api/bankAccounts.api'
import { useBranchContextStore } from '../../branch_context'
import { UploadDropzone } from './upload-modal/UploadDropzone'
import { BankAccountSelect } from './upload-modal/BankAccountSelect'

interface BankAccount {
  id: number
  bank_id: number
  account_name: string
  account_number: string
  bank_name?: string
}

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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use branch context untuk company_id
  const currentBranch = useBranchContextStore((state) => state.currentBranch)
  const companyId = currentBranch?.company_id

  const fetchBankAccounts = useCallback(async () => {
    if (!companyId) {
      setBankAccounts([])
      return
    }

    setLoadingAccounts(true)
    try {
      const accounts = await bankAccountsApi.getByOwner('company', companyId)
      setBankAccounts(accounts || [])
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err)
      setBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }, [companyId])

  // Fetch bank accounts when modal opens or company changes
  useEffect(() => {
    if (isOpen) {
      if (companyId) {
        fetchBankAccounts()
      } else {
        setLoadingAccounts(false)
        setBankAccounts([])
      }
    }
  }, [isOpen, companyId, fetchBankAccounts])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setBankAccountId('')
      setError(null)
    }
  }, [isOpen])

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

  const hasBankAccounts = bankAccounts.length > 0
  const canSubmit = file && bankAccountId && hasBankAccounts && !isLoading

  return (
    <div className="modal modal-open backdrop-blur-sm bg-black/30">
      <div className="modal-box max-w-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl rounded-2xl p-0 overflow-hidden transform transition-all duration-300 scale-100 opacity-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/10 rounded-xl">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Upload Bank Statement
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Import data mutasi bank
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-sm btn-ghost btn-circle hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Bank Account Selection */}
          <div className="space-y-2">
            <BankAccountSelect
              value={bankAccountId}
              onChange={setBankAccountId}
              disabled={isLoading}
              error={!companyId ? 'Company belum dipilih' : undefined}
            />
          </div>

          {!companyId && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
              <div className="text-amber-500 mt-0.5">⚠️</div>
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Silakan pilih branch terlebih dahulu untuk mengakses akun bank.
              </p>
            </div>
          )}

          {companyId && !loadingAccounts && bankAccounts.length === 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
              <div className="text-amber-500 mt-0.5">⚠️</div>
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  Tidak ada akun bank ditemukan.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  Buat akun bank di menu Bank Accounts terlebih dahulu.
                </p>
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          <div>
            <UploadDropzone
              onFileSelect={handleFileChange}
              onFileRemove={removeFile}
              selectedFile={file}
              isDragOver={isDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              isLoading={isLoading}
              uploadProgress={uploadProgress}
              error={error}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-md flex justify-end gap-3">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            type="button"
            className={`
              px-5 py-2.5 rounded-xl font-medium text-white text-sm shadow-lg shadow-blue-500/20 
              flex items-center gap-2 transition-all transform active:scale-95
              ${canSubmit ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/30' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'}
            `}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengupload... {uploadProgress}%</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Upload & Analisis</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div 
        className="modal-backdrop bg-black/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
    </div>
  )
}

