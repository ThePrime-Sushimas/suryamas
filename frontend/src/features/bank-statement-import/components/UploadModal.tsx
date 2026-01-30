import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X, CheckCircle, Loader2, FileText, Sparkles, ArrowRight } from 'lucide-react'
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
        
        {/* Header dengan Gradient */}
        <div className="relative overflow-hidden bg-linear-to-br from-blue-500 via-indigo-500 to-purple-600">
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
          </div>

          {/* Content */}
          <div className="relative p-6 pb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">
                    Upload Bank Statement
                  </h3>
                  <p className="text-sm text-blue-100 dark:text-blue-200 mt-1">
                    Import data mutasi bank dengan mudah
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 mt-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs text-white">
                <FileText className="w-3.5 h-3.5" />
                <span>Excel & CSV</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs text-white">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-detect</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs text-white">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Cepat & Aman</span>
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
        
        {/* Body Content */}
        <div className="p-6 space-y-6 bg-white dark:bg-gray-900">
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
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Data terenkripsi & aman</span>
          </div>
          <div className="flex gap-3">
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
                px-6 py-2.5 rounded-xl font-medium text-white text-sm shadow-lg shadow-blue-500/20 
                flex items-center gap-2 transition-all transform active:scale-95 group
                ${canSubmit 
                  ? 'bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-blue-600/30' 
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'
                }
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
                  <span>Upload & Analisis</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

