# 📊 Bank Statement Import Frontend Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [Features](#features)
4. [Components](#components)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Type Definitions](#type-definitions)
8. [Constants](#constants)
9. [Usage Examples](#usage-examples)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## 1. Overview

Module frontend untuk mengimport mutasi bank dari file Excel. Module ini memungkinkan pengguna untuk:
- Upload file Excel mutasi bank
- Preview dan analisis data sebelum import
- Menangani duplikasi data
- Proses import secara asinkron menggunakan Job Queue

---

## 2. Folder Structure

```
frontend/src/features/bank-statement-import/
├── index.ts                              # Module exports
├── types/
│   └── bank-statement-import.types.ts    # TypeScript interfaces
├── api/
│   └── bank-statement-import.api.ts      # API calls
├── components/
│   ├── BankStatementImportPage.tsx       # Main page
│   ├── UploadModal.tsx                   # File upload modal
│   ├── AnalysisModal.tsx                 # Analysis preview modal
│   ├── ConfirmModal.tsx                  # Confirmation modal
│   ├── BankStatementImportTable.tsx      # Data table
│   ├── ImportProgress.tsx                # Progress indicator
│   └── ErrorBoundary.tsx                 # Error boundary
├── store/
│   └── bank-statement-import.store.ts   # Zustand store
├── constants/
│   └── bank-statement-import.constants.ts # Constants
├── utils/
│   ├── format.ts                         # Formatting utilities
│   ├── validation.ts                     # Validation helpers
│   └── business-rules.util.ts            # Business rules
└── hooks/
    └── useBankStatementImport.ts         # Custom hooks
```

---

## 3. Features

### 3.1 File Upload
- Upload file Excel (.xlsx, .xls)
- Validasi ukuran file (max 50MB)
- Validasi tipe file
- Progress indicator saat upload
- Cancel upload functionality

### 3.2 File Analysis
- Preview data sebelum import
- Validasi format kolom
- Deteksi duplikasi
- Kalkulasi statistik (total rows, valid/invalid, duplicates)
- Peringatan tanggal (future dates, old data)

### 3.3 Import Confirmation
- Konfirmasi import dengan opsi skip duplicates
- Batch operations (multiple select)
- Cancel import yang sedang berjalan

### 3.4 Data Management
- Tabel data dengan pagination
- Sorting dan filtering
- Search functionality
- Export data

### 3.5 Status Tracking
- Real-time progress monitoring
- Status badges (PENDING, ANALYZED, IMPORTING, COMPLETED, FAILED)
- Error handling dengan detail pesan

---

## 4. Components

### 4.1 BankStatementImportPage

**Lokasi:** `components/BankStatementImportPage.tsx`

Halaman utama untuk mengelola import bank statement.

```tsx
import { BankStatementImportPage } from '@/features/bank-statement-import'

// Usage dalam route
<Route path="/bank-statement-import" element={
  <BankStatementImportPage />
} />
```

**Props:** Tidak ada (menggunakan store untuk state)

**Fungsi:**
- Menampilkan header halaman
- Filter dan search controls
- Bulk action bar
- Data table
- Modals (Upload, Analysis, Confirm)

---

### 4.2 UploadModal

**Lokasi:** `components/UploadModal.tsx`

Modal untuk upload file Excel.

```tsx
interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, bankAccountId: string) => Promise<void>
  isLoading: boolean
  uploadProgress: number
}

<UploadModal
  isOpen={showUploadModal}
  onClose={() => setShowUploadModal(false)}
  onUpload={handleUpload}
  isLoading={loading.list}
  uploadProgress={uploadProgress}
/>
```

**Fitur:**
- Drag and drop file
- File validation
- Progress bar
- File info display

---

### 4.3 AnalysisModal

**Lokasi:** `components/AnalysisModal.tsx`

Modal untuk preview analisis sebelum konfirmasi.

```tsx
interface AnalysisModalProps {
  result: BankStatementAnalysisResult | null
  onConfirm: (skipDuplicates: boolean) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

<AnalysisModal
  result={analyzeResult}
  onConfirm={handleConfirm}
  onCancel={clearAnalyzeResult}
  isLoading={loading.confirm}
/>
```

**Tampilan:**
- Statistics grid (total, new, duplicates)
- Date range warnings
- Duplicate preview table
- Action buttons (Import All / Skip Duplicates / Cancel)

---

### 4.4 BankStatementImportTable

**Lokasi:** `components/BankStatementImportTable.tsx`

Tabel untuk menampilkan daftar import.

```tsx
interface BankStatementImportTableProps {
  imports: BankStatementImport[]
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  onSelectAll: (checked: boolean) => void
  onDelete: (id: string) => void
  onViewDetails: (id: string) => void
  isLoading: boolean
}

<BankStatementImportTable
  imports={filteredImports}
  selectedIds={selectedIds}
  onToggleSelection={toggleSelection}
  onSelectAll={selectAll}
  onDelete={handleDelete}
  onViewDetails={navigateToDetail}
  isLoading={loading.delete}
/>
```

**Kolom:**
- [ ] Checkbox (untuk selection)
- [ ] File Name
- [ ] Bank Account
- [ ] Date Range
- [ ] Total Rows
- [ ] Status
- [ ] Import Date
- [ ] Actions (View, Delete)

---

### 4.5 ImportProgress

**Lokasi:** `components/ImportProgress.tsx`

Komponen progress indicator untuk import yang sedang berjalan.

```tsx
interface ImportProgressProps {
  importId: string
  totalRows: number
  processedRows: number
  status: BankStatementImportStatus
  estimatedTimeRemaining?: number
}

<ImportProgress
  importId={currentImport.id}
  totalRows={currentImport.total_rows}
  processedRows={currentImport.processed_rows}
  status={currentImport.status}
/>
```

---

## 5. State Management

### 5.1 Zustand Store

**Lokasi:** `store/bank-statement-import.store.ts`

```typescript
import { create } from 'zustand'
import { bankStatementImportsApi } from '../api/bank-statement-import.api'

interface BankStatementImportState {
  // Data
  imports: BankStatementImport[]
  currentImport: BankStatementImport | null
  analyzeResult: BankStatementAnalysisResult | null
  uploads: Map<string, UploadSession>
  
  // Selection
  selectedIds: Set<string>
  
  // Pagination
  pagination: {
    page: number
    limit: number
    total: number
  }
  
  // Filters
  filters: {
    bank_account_id?: string
    status?: string
    date_from?: string
    date_to?: string
    search?: string
  }
  
  // Loading states
  loading: {
    list: boolean
    upload: boolean
    confirm: boolean
    delete: boolean
    batch: boolean
  }
  
  // Errors
  errors: {
    upload: string | null
    confirm: string | null
    delete: string | null
    validation: string | null
    general: string | null
  }
  
  // Actions
  fetchImports: (params?: FetchParams) => Promise<void>
  uploadFile: (file: File, bankAccountId: string, userId: string) => Promise<string>
  cancelUpload: (uploadId: string) => void
  confirmImport: (id: string, skipDuplicates: boolean) => Promise<void>
  deleteImport: (id: string) => Promise<void>
  batchConfirm: (ids: string[], skipDuplicates: boolean) => Promise<void>
  batchDelete: (ids: string[]) => Promise<void>
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  setFilters: (filters: ImportFilters) => void
  setPagination: (page: number, limit?: number) => void
  clearAnalyzeResult: () => void
  clearError: (type?: keyof State['errors']) => void
  reset: () => void
}

export const useBankStatementImportStore = create<BankStatementImportState>((set, get) => ({
  // Initial state
  imports: [],
  currentImport: null,
  analyzeResult: null,
  uploads: new Map(),
  selectedIds: new Set(),
  pagination: {
    page: 1,
    limit: BANK_STATEMENT_IMPORT_DEFAULT_PAGE_SIZE,
    total: 0
  },
  filters: {},
  loading: {
    list: false,
    upload: false,
    confirm: false,
    delete: false,
    batch: false
  },
  errors: {
    upload: null,
    confirm: null,
    delete: null,
    validation: null,
    general: null
  },

  // Actions
  fetchImports: async (params) => {
    set({ loading: { ...get().loading, list: true } })
    try {
      const { page, limit, filters } = params || {}
      const data = await bankStatementImportsApi.list({
        page: page || get().pagination.page,
        limit: limit || get().pagination.limit,
        ...filters
      })
      set({
        imports: data.data,
        pagination: data.pagination,
        loading: { ...get().loading, list: false }
      })
    } catch (error) {
      set({
        errors: { ...get().errors, general: error.message },
        loading: { ...get().loading, list: false }
      })
    }
  },

  uploadFile: async (file, bankAccountId, userId) => {
    // Validate
    const uploadValidation = validateUpload(file, get().lastUploadTime)
    if (!uploadValidation.valid) {
      throw new Error(uploadValidation.error)
    }

    // Check concurrent upload
    if (get().isUploading) {
      throw new Error('Another upload is in progress')
    }

    const uploadId = crypto.randomUUID()
    const controller = new AbortController()

    set({
      isUploading: true,
      lastUploadTime: Date.now()
    })

    try {
      const result = await bankStatementImportsApi.upload(
        file,
        bankAccountId,
        controller.signal,
        (progress) => {
          const uploads = new Map(get().uploads)
          const session = uploads.get(uploadId)
          if (session) {
            session.progress = progress
            set({ uploads })
          }
        }
      )

      const uploads = new Map(get().uploads)
      const session = uploads.get(uploadId)
      if (session) {
        session.status = 'complete'
        session.result = result
        set({ uploads, analyzeResult: result, isUploading: false })
      }

      return uploadId
    } catch (error) {
      const uploads = new Map(get().uploads)
      const session = uploads.get(uploadId)
      if (session) {
        session.status = 'error'
        session.error = error.message
      }
      set({ uploads, isUploading: false, errors: { ...get().errors, upload: error.message } })
      throw error
    }
  },

  confirmImport: async (id, skipDuplicates) => {
    set({ loading: { ...get().loading, confirm: true } })
    try {
      await bankStatementImportsApi.confirm(id, skipDuplicates)
      set({ analyzeResult: null, loading: { ...get().loading, confirm: false } })
      await get().fetchImports()
    } catch (error) {
      set({
        errors: { ...get().errors, confirm: error.message },
        loading: { ...get().loading, confirm: false }
      })
      throw error
    }
  },

  deleteImport: async (id) => {
    const previousImports = get().imports
    set({ imports: get().imports.filter(imp => imp.id !== id) })

    try {
      await bankStatementImportsApi.delete(id)
    } catch (error) {
      set({ imports: previousImports, errors: { ...get().errors, delete: error.message } })
      throw error
    }
  },

  // Batch operations
  batchConfirm: async (ids, skipDuplicates) => {
    set({ loading: { ...get().loading, batch: true } })
    try {
      await Promise.all(ids.map(id => bankStatementImportsApi.confirm(id, skipDuplicates)))
      set({ selectedIds: new Set(), loading: { ...get().loading, batch: false } })
      await get().fetchImports()
    } catch (error) {
      set({ errors: { ...get().errors, confirm: error.message }, loading: { ...get().loading, batch: false } })
      throw error
    }
  },

  batchDelete: async (ids) => {
    const previousImports = get().imports
    set({ imports: get().imports.filter(imp => !ids.includes(imp.id)) })

    try {
      await Promise.all(ids.map(id => bankStatementImportsApi.delete(id)))
      set({ selectedIds: new Set() })
    } catch (error) {
      set({ imports: previousImports, errors: { ...get().errors, delete: error.message } })
      throw error
    }
  },

  toggleSelection: (id) => {
    const selectedIds = new Set(get().selectedIds)
    if (selectedIds.has(id)) {
      selectedIds.delete(id)
    } else {
      selectedIds.add(id)
    }
    set({ selectedIds })
  },

  selectAll: () => {
    const selectedIds = new Set(get().imports.map(imp => imp.id))
    set({ selectedIds })
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  setFilters: (filters) => {
    set({ filters, pagination: { ...get().pagination, page: 1 } })
    get().fetchImports()
  },

  setPagination: (page, limit) => {
    const newPagination = { ...get().pagination, page, ...(limit && { limit }) }
    set({ pagination: newPagination })
    get().fetchImports()
  },

  clearAnalyzeResult: () => set({ analyzeResult: null }),

  clearError: (type) => {
    if (type) {
      set({ errors: { ...get().errors, [type]: null } })
    } else {
      set({ errors: { upload: null, confirm: null, delete: null, validation: null, general: null } })
    }
  },

  reset: () => {
    get().uploads.forEach(session => session.controller.abort())
    set({
      imports: [],
      currentImport: null,
      analyzeResult: null,
      uploads: new Map(),
      selectedIds: new Set(),
      pagination: { page: 1, limit: BANK_STATEMENT_IMPORT_DEFAULT_PAGE_SIZE, total: 0 },
      filters: {},
      loading: { list: false, upload: false, confirm: false, delete: false, batch: false },
      errors: { upload: null, confirm: null, delete: null, validation: null, general: null },
      isUploading: false,
      lastUploadTime: null
    })
  }
}))
```

---

## 6. API Integration

### 6.1 API Module

**Lokasi:** `api/bank-statement-import.api.ts`

```typescript
import api from '@/lib/axios'

// Constants
export const BANK_STATEMENT_IMPORT_MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const BANK_STATEMENT_IMPORT_UPLOAD_TIMEOUT = 120000 // 2 minutes
export const BANK_STATEMENT_IMPORT_DEFAULT_PAGE_SIZE = 50

const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

// File validation
function validateFile(file: File): void {
  if (file.size > BANK_STATEMENT_IMPORT_MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${BANK_STATEMENT_IMPORT_MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    )
    if (!hasValidExtension) {
      throw new Error('Invalid file type. Only Excel (.xlsx, .xls) are allowed')
    }
  }

  if (file.size === 0) {
    throw new Error('File is empty')
  }
}

// Types
interface ListParams {
  page?: number
  limit?: number
  bank_account_id?: string
  status?: string
  date_from?: string
  date_to?: string
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}

interface ListResponse {
  data: BankStatementImport[]
  pagination?: {
    total: number
    page: number
    limit: number
  }
}

interface StatementsResponse {
  data: BankStatement[]
  pagination?: {
    total: number
    page: number
    limit: number
  }
}

export const bankStatementImportsApi = {
  // List imports
  list: async (params?: ListParams, signal?: AbortSignal): Promise<ListResponse> => {
    const response = await api.get('/bank-statement-imports', { params, signal })
    return response.data
  },

  // Get import by ID
  getById: async (id: string, signal?: AbortSignal): Promise<{ data: BankStatementImport }> => {
    const response = await api.get(`/bank-statement-imports/${id}`, { signal })
    return response.data
  },

  // Upload file
  upload: async (
    file: File,
    bankAccountId: string,
    signal?: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<BankStatementAnalysisResult> => {
    validateFile(file)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bank_account_id', bankAccountId)

    const response = await api.post('/bank-statement-imports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: BANK_STATEMENT_IMPORT_UPLOAD_TIMEOUT,
      signal,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })

    return response.data.data
  },

  // Confirm import
  confirm: async (id: string, skipDuplicates: boolean = true, signal?: AbortSignal) => {
    const response = await api.post(
      `/bank-statement-imports/${id}/confirm`,
      { skip_duplicates: skipDuplicates },
      { signal }
    )
    return response.data
  },

  // Delete import
  delete: async (id: string, signal?: AbortSignal) => {
    await api.delete(`/bank-statement-imports/${id}`, { signal })
  },

  // Get statements for import
  getStatements: async (
    id: string,
    page: number = 1,
    limit: number = BANK_STATEMENT_IMPORT_DEFAULT_PAGE_SIZE,
    signal?: AbortSignal
  ): Promise<StatementsResponse> => {
    const response = await api.get(`/bank-statement-imports/${id}/statements`, {
      params: { page, limit, sort: 'transaction_date', order: 'desc' },
      signal
    })
    return response.data
  },

  // Export statements
  export: async (id: string, signal?: AbortSignal): Promise<Blob> => {
    const response = await api.get(`/bank-statement-imports/${id}/export`, {
      responseType: 'blob',
      signal
    })
    return response.data
  },

  // Get import summary
  getSummary: async (id: string, signal?: AbortSignal): Promise<{
    totalDebit: number
    totalCredit: number
    totalBalance: number
    transactionCount: number
  }> => {
    const response = await api.get(`/bank-statement-imports/${id}/summary`, { signal })
    return response.data.data
  }
}
```

---

## 7. Type Definitions

### 7.1 Types

**Lokasi:** `types/bank-statement-import.types.ts`

```typescript
/**
 * Bank Statement Import Status
 */
export type BankStatementImportStatus =
  | 'PENDING'       // Uploaded, waiting for analysis
  | 'ANALYZED'      // Analysis complete, ready to confirm
  | 'IMPORTING'     // Processing (job in progress)
  | 'COMPLETED'     // All rows imported successfully
  | 'FAILED'        // Import failed with error

/**
 * Bank Statement Transaction Type
 */
export type BankTransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'PAYMENT'
  | 'FEE'
  | 'INTEREST'
  | 'OTHER'

/**
 * Bank Statement Import Record
 */
export interface BankStatementImport {
  id: string
  company_id: string
  bank_account_id: number
  file_name: string
  file_size?: number
  file_hash?: string
  status: BankStatementImportStatus
  total_rows: number
  processed_rows: number
  failed_rows: number
  date_range_start?: string
  date_range_end?: string
  error_message?: string
  job_id?: string
  created_at: string
  updated_at: string
  created_by?: string
}

/**
 * Bank Statement Record
 */
export interface BankStatement {
  id: string
  bank_statement_import_id: string
  row_number: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: number
  credit_amount: number
  balance?: number
  transaction_type?: BankTransactionType
  is_reconciled: boolean
  created_at: string
}

/**
 * Analysis Result from Upload
 */
export interface BankStatementAnalysisResult {
  import: BankStatementImport
  analysis: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    date_range_start?: string
    date_range_end?: string
    preview: BankStatementPreviewRow[]
    duplicates: BankStatementDuplicate[]
    warnings: string[]
  }
  job_id?: string
}

/**
 * Preview Row for UI
 */
export interface BankStatementPreviewRow {
  row_number: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: number
  credit_amount: number
  balance?: number
  is_valid: boolean
  errors: string[]
}

/**
 * Duplicate Detection Result
 */
export interface BankStatementDuplicate {
  reference_number?: string
  transaction_date: string
  debit_amount: number
  credit_amount: number
  description: string
  existing_statement_id?: string
  existing_import_id?: string
  match_score: number
}

/**
 * Upload Session
 */
export interface UploadSession {
  id: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  result?: BankStatementAnalysisResult
  error?: string
  controller: AbortController
  timestamp: Date
  userId: string
  bankAccountId: string
  fileName: string
  fileSize: number
}
```

---

## 8. Constants

### 8.1 Constants File

**Lokasi:** `constants/bank-statement-import.constants.ts`

```typescript
// File size limits
export const BANK_STATEMENT_IMPORT_MAX_FILE_SIZE_MB = 50
export const BANK_STATEMENT_IMPORT_MAX_FILE_SIZE_BYTES = 
  BANK_STATEMENT_IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024

// Display limits
export const BANK_STATEMENT_IMPORT_MAX_VISIBLE_DUPLICATES = 10
export const BANK_STATEMENT_IMPORT_MAX_PREVIEW_ROWS = 10

// Timeouts
export const BANK_STATEMENT_IMPORT_UPLOAD_TIMEOUT_MS = 120000 // 2 minutes
export const BANK_STATEMENT_IMPORT_POLL_INTERVAL_MS = 2000

// Pagination
export const BANK_STATEMENT_IMPORT_DEFAULT_PAGE_SIZE = 50

// Rate limiting
export const BANK_STATEMENT_IMPORT_UPLOAD_COOLDOWN_MS = 5000

// Status colors (Tailwind classes)
export const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-800',
  ANALYZED: 'bg-blue-100 text-blue-800',
  IMPORTING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800'
} as const

// Transaction type colors
export const TRANSACTION_TYPE_COLORS = {
  DEPOSIT: 'bg-green-100 text-green-800',
  WITHDRAWAL: 'bg-red-100 text-red-800',
  TRANSFER: 'bg-blue-100 text-blue-800',
  PAYMENT: 'bg-purple-100 text-purple-800',
  FEE: 'bg-orange-100 text-orange-800',
  INTEREST: 'bg-teal-100 text-teal-800',
  OTHER: 'bg-gray-100 text-gray-800'
} as const
```

---

## 9. Usage Examples

### 9.1 Basic Page Implementation

```tsx
// pages/BankStatementImportPage.tsx
import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { useBankStatementImportStore } from '@/features/bank-statement-import'
import { UploadModal } from '@/features/bank-statement-import/components/UploadModal'
import { AnalysisModal } from '@/features/bank-statement-import/components/AnalysisModal'
import { BankStatementImportTable } from '@/features/bank-statement-import/components/BankStatementImportTable'
import { useBankAccountStore } from '@/features/bank-accounts'
import { useToast } from '@/contexts/ToastContext'

export const BankStatementImportPage = () => {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const toast = useToast()
  const currentBankAccount = useBankAccountStore(s => s.currentBankAccount)
  
  const {
    imports,
    analyzeResult,
    selectedIds,
    loading,
    errors,
    fetchImports,
    uploadFile,
    confirmImport,
    deleteImport,
    toggleSelection,
    selectAll,
    clearSelection,
    clearAnalyzeResult,
    clearError,
    reset
  } = useBankStatementImportStore()

  useEffect(() => {
    fetchImports()
    return () => reset()
  }, [])

  const handleUpload = async (file: File, bankAccountId: string) => {
    try {
      await uploadFile(file, bankAccountId, 'user-id')
      setShowUploadModal(false)
      toast.success('File uploaded successfully')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleConfirm = async (skipDuplicates: boolean) => {
    try {
      await confirmImport(analyzeResult.import.id, skipDuplicates)
      clearAnalyzeResult()
      toast.success('Import confirmed successfully')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bank Statement Import</h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload size={20} />
          Upload Excel
        </button>
      </div>

      {/* Table */}
      <BankStatementImportTable
        imports={imports}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        onSelectAll={(checked) => checked ? selectAll() : clearSelection()}
        onDelete={deleteImport}
        onViewDetails={(id) => console.log('View', id)}
        isLoading={loading.delete}
      />

      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        isLoading={loading.upload}
        uploadProgress={0}
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
```

### 9.2 Using Hook

```tsx
// hooks/useBankStatementImport.ts
import { useCallback } from 'react'
import { useBankStatementImportStore } from '@/features/bank-statement-import'

export const useBankStatementImport = () => {
  const store = useBankStatementImportStore()

  const handleUpload = useCallback(async (file: File) => {
    if (!store.currentBankAccount?.id) {
      throw new Error('Bank account not selected')
    }
    return store.uploadFile(file, store.currentBankAccount.id, 'user-id')
  }, [store])

  const handleConfirm = useCallback(async (skipDuplicates: boolean) => {
    if (!store.analyzeResult?.import.id) {
      throw new Error('No analysis result')
    }
    return store.confirmImport(store.analyzeResult.import.id, skipDuplicates)
  }, [store])

  return {
    imports: store.imports,
    loading: store.loading,
    errors: store.errors,
    uploadFile: handleUpload,
    confirmImport: handleConfirm,
    deleteImport: store.deleteImport,
    fetchImports: store.fetchImports
  }
}
```

---

## 10. Best Practices

### 10.1 File Validation

```typescript
// utils/validation.ts
export const validateBankStatementFile = (file: File): ValidationResult => {
  const errors: string[] = []

  // Check file extension
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    errors.push('File must be Excel format (.xlsx or .xls)')
  }

  // Check file size
  if (file.size > BANK_STATEMENT_IMPORT_MAX_FILE_SIZE_BYTES) {
    errors.push(`File size exceeds ${BANK_STATEMENT_IMPORT_MAX_FILE_SIZE_MB}MB`)
  }

  // Check file not empty
  if (file.size === 0) {
    errors.push('File is empty')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

### 10.2 Error Handling

```typescript
// Error boundary wrapper
export const BankStatementImportErrorBoundary = ({ 
  children,
  fallback 
}: ErrorBoundaryProps) => {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('Bank Statement Import Error:', error)
        // Send to error reporting service
      }}
      fallback={fallback}
    >
      {children}
    </ErrorBoundary>
  )
}
```

### 10.3 Performance Optimization

```typescript
// Memoized table untuk data besar
import { memo } from 'react'

export const BankStatementImportTable = memo(function BankStatementImportTable({
  imports,
  ...props
}) {
  // Table implementation
  return <table>...</table>
})

// Virtual scrolling untuk preview yang besar
import { useVirtualizer } from '@tanstack/react-virtual'

const previewRows = useVirtualizer({
  count: previewData.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 35,
})
```

---

## 11. Troubleshooting

### 11.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Upload stuck at 0% | File too large | Check file size < 50MB |
| Analysis shows 0 rows | Wrong column format | Check required columns exist |
| Duplicates not detected | Reference number mismatch | Verify reference format |
| Import failed midway | Database timeout | Retry or increase timeout |
| Status not updating | Polling stopped | Refresh page |

### 11.2 Debug Mode

```typescript
// Enable debug logging
const DEBUG = true

if (DEBUG) {
  console.log('[BankStatementImport] Upload started', { fileName, size })
  console.log('[BankStatementImport] Analysis result', result)
  console.log('[BankStatementImport] Import confirmed', { importId, jobId })
}
```

---

## 12. Related Documentation

- [Backend Documentation](../backend/src/modules/reconciliation/bank-statement-import/BANK_STATEMENT_IMPORT_MD.md)
- [Implementation Guide Part 1](../backend/src/modules/reconciliation/bank-statement-import/bank-statement-import-implementation-guide.md)
- [Implementation Guide Part 2](../backend/src/modules/reconciliation/bank-statement-import/bank-statement-import-implementation-guide-part2.md)
- [Practical Guide](../backend/src/modules/reconciliation/bank-statement-import/bank-statement-import-practical-guide.md)
- [POS Imports Reference](../frontend/src/features/pos-imports)

---

**Last Updated:** 2024  
**Version:** 1.0  
**Author:** Frontend Team

