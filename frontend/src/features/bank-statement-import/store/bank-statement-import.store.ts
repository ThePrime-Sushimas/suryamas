import { create } from 'zustand'
import axios from 'axios'
import { bankStatementImportApi } from '../api/bank-statement-import.api'
import type {
  BankStatementImport,
  BankStatementAnalysisResult,
  BankStatementImportFilters,
} from '../types/bank-statement-import.types'
import { BANK_STATEMENT_IMPORT_PAGE_SIZE } from '../constants/bank-statement-import.constants'

// ============================================================================
// ERROR MESSAGE MAPPINGS - User-friendly error messages
// ============================================================================

interface ErrorMapping {
  pattern: RegExp | string
  userMessage: string
  title: string
  action?: string
}

const ERROR_MAPPINGS: ErrorMapping[] = [
  // File upload errors
  {
    pattern: /FILE_TOO_LARGE|file too large/i,
    userMessage: 'Ukuran file terlalu besar. Maksimal ukuran file adalah 50MB. Silakan kompres file atau gunakan file yang lebih kecil.',
    title: 'File Terlalu Besar',
    action: 'Coba gunakan file dengan ukuran lebih kecil'
  },
  {
    pattern: /INVALID_FILE_TYPE|invalid file type|file type not allowed/i,
    userMessage: 'Format file tidak didukung. Gunakan file Excel (.xlsx, .xls) atau CSV (.csv).',
    title: 'Format File Tidak Didukung',
    action: 'Gunakan format file yang benar'
  },
  {
    pattern: /NO_FILE_UPLOADED|no file uploaded/i,
    userMessage: 'Silakan pilih file terlebih dahulu untuk diupload.',
    title: 'Belum Ada File',
    action: 'Pilih file dari komputer Anda'
  },
  {
    pattern: /EMPTY_FILE|file is empty|corrupted|rusak/i,
    userMessage: 'File kosong atau tidak valid. Silakan pastikan file berisi data yang benar.',
    title: 'File Tidak Valid',
    action: 'Buka file di Excel dan pastikan data tersedia'
  },
  
  // Bank account errors
  {
    pattern: /BANK_ACCOUNT_NOT_FOUND|bank account.*not found|akun bank.*tidak ditemukan/i,
    userMessage: 'Akun bank tidak ditemukan. Akun mungkin sudah dihapus.',
    title: 'Akun Bank Tidak Ditemukan',
    action: 'Pilih akun bank lain dari dropdown'
  },
  {
    pattern: /BANK_ACCOUNT_INACTIVE|inactive|tidak aktif/i,
    userMessage: 'Akun bank tidak aktif. Silakan aktifkan akun tersebut di menu Bank Accounts.',
    title: 'Akun Bank Tidak Aktif',
    action: 'Aktifkan akun bank di menu Bank Accounts'
  },
  {
    pattern: /BANK_ACCOUNT_COMPANY_MISMATCH|not belong to your company|bukan milik/i,
    userMessage: 'Akun bank bukan milik perusahaan Anda. Silakan pilih akun bank yang benar.',
    title: 'Akun Bank Tidak Sesuai',
    action: 'Pilih akun bank yang terdaftar di perusahaan Anda'
  },
  {
    pattern: /NO_BANK_ACCOUNTS|no bank accounts/i,
    userMessage: 'Tidak ada akun bank tersedia. Silakan tambah akun bank di menu Bank Accounts.',
    title: 'Tidak Ada Akun Bank',
    action: 'Tambah akun bank di menu Bank Accounts'
  },
  
  // Validation errors
  {
    pattern: /MISSING_REQUIRED_COLUMNS|missing required columns|kolom wajib/i,
    userMessage: 'File tidak lengkap. Beberapa kolom yang wajib ada tidak ditemukan.',
    title: 'Kolom Tidak Lengkap',
    action: 'Gunakan template yang disediakan'
  },
  {
    pattern: /INVALID_DATE_FORMAT|invalid date|format tanggal/i,
    userMessage: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD, DD/MM/YYYY, atau MM/DD/YYYY.',
    title: 'Format Tanggal Salah',
    action: 'Perbaiki format tanggal di file Excel'
  },
  {
    pattern: /INVALID_AMOUNT_FORMAT|invalid amount|format jumlah/i,
    userMessage: 'Format jumlah tidak valid. Gunakan angka tanpa simbol mata uang (contoh: 1000000).',
    title: 'Format Jumlah Salah',
    action: 'Perbaiki format angka di file Excel'
  },
  
  // Permission errors
  {
    pattern: /BRANCH_CONTEXT_REQUIRED|pilih branch|select branch/i,
    userMessage: 'Silakan pilih branch terlebih dahulu untuk mengakses fitur ini.',
    title: 'Branch Belum Dipilih',
    action: 'Pilih branch di selector bagian kiri atas'
  },
  {
    pattern: /COMPANY_ACCESS_DENIED|access denied|tidak memiliki akses/i,
    userMessage: 'Anda tidak memiliki akses ke perusahaan ini. Silakan hubungi administrator.',
    title: 'Akses Ditolak',
    action: 'Hubungi administrator untuk mendapatkan akses'
  },
  {
    pattern: /PERMISSION_DENIED|permission denied|izin/i,
    userMessage: 'Anda tidak memiliki izin untuk melakukan tindakan ini. Silakan hubungi administrator.',
    title: 'Izin Ditolak',
    action: 'Hubungi administrator untuk mendapatkan izin'
  },
  
  // Import status errors
  {
    pattern: /IMPORT_NOT_FOUND|not found|tidak ditemukan/i,
    userMessage: 'Data import tidak ditemukan. Kemungkinan data sudah dihapus.',
    title: 'Data Import Tidak Ditemukan',
    action: 'Refresh halaman untuk memperbarui daftar'
  },
  {
    pattern: /ALREADY_ANALYZED|already|udah|sudah/i,
    userMessage: 'Data ini sudah dalam tahap analisis. Silakan refresh halaman.',
    title: 'Sudah Diproses',
    action: 'Refresh halaman'
  },
  {
    pattern: /DUPLICATE_FILE|already uploaded|sudah diupload/i,
    userMessage: 'File sudah pernah diupload. Silakan gunakan file yang berbeda.',
    title: 'File Duplikat',
    action: 'Gunakan file yang berbeda atau hapus import sebelumnya'
  },
  
  // Processing errors
  {
    pattern: /PROCESSING_FAILED|processing failed|gagal memproses/i,
    userMessage: 'Gagal memproses import. Silakan coba lagi atau hubungi administrator.',
    title: 'Gagal Memproses',
    action: 'Coba lagi atau hubungi administrator'
  },
  {
    pattern: /IMPORT_FAILED|import failed|gagal mengimpor/i,
    userMessage: 'Gagal mengimpor data. Silakan coba lagi.',
    title: 'Gagal Import',
    action: 'Coba lagi'
  },
  {
    pattern: /CONFIRMATION_FAILED|confirm failed/i,
    userMessage: 'Gagal mengkonfirmasi import. Silakan coba lagi.',
    title: 'Gagal Konfirmasi',
    action: 'Coba lagi'
  },
  
  // Network errors
  {
    pattern: /network|NetworkError|CERTIFICATE|certificate/i,
    userMessage: 'Terjadi masalah koneksi. Silakan cek koneksi internet Anda.',
    title: 'Koneksi Bermasalah',
    action: 'Cek koneksi internet dan coba lagi'
  },
  {
    pattern: /timeout|TIMEOUT|ETIMEDOUT/i,
    userMessage: 'Waktu tunggu habis. Silakan coba lagi.',
    title: 'Waktu Habis',
    action: 'Coba lagi'
  },
  {
    pattern: /ECONNREFUSED|connection refused/i,
    userMessage: 'Tidak dapat terhubung ke server. Silakan hubungi administrator.',
    title: 'Tidak Terhubung',
    action: 'Hubungi administrator'
  },
  
  // Generic server errors
  {
    pattern: /500|Internal Server Error|server error/i,
    userMessage: 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi administrator.',
    title: 'Kesalahan Server',
    action: 'Coba lagi atau hubungi administrator'
  },
  {
    pattern: /401|Unauthorized|tidak sah/i,
    userMessage: 'Sesi Anda telah berakhir. Silakan login kembali.',
    title: 'Sesi Berakhir',
    action: 'Login kembali'
  },
  {
    pattern: /403|Forbidden/i,
    userMessage: 'Akses ditolak. Anda tidak memiliki izin untuk tindakan ini.',
    title: 'Akses Ditolak',
    action: 'Hubungi administrator'
  },
  {
    pattern: /404|Not Found|tidak ditemukan/i,
    userMessage: 'Data tidak ditemukan. Silakan refresh halaman.',
    title: 'Data Tidak Ditemukan',
    action: 'Refresh halaman'
  },
  {
    pattern: /429|Too Many Requests|rate limit/i,
    userMessage: 'Terlalu banyak permintaan. Silakan tunggu sebentar dan coba lagi.',
    title: 'Terlalu Banyak Permintaan',
    action: 'Tunggu sebentar dan coba lagi'
  },
]

// Helper function untuk extract error message dari berbagai tipe error
function getErrorMessage(error: unknown): string {
  // Default message
  let message = 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.'

  if (axios.isAxiosError(error)) {
    // PRIORITY 1: Check for context.userMessage first (from our backend errors)
    if (error.response?.data?.context?.userMessage) {
      return error.response.data.context.userMessage
    }
    
    // PRIORITY 2: Check for error response message
    if (error.response?.data?.message) {
      const serverMessage = Array.isArray(error.response.data.message) 
        ? error.response.data.message.join(', ')
        : error.response.data.message
      
      // Try to find matching error mapping
      const mapping = ERROR_MAPPINGS.find(m => 
        typeof m.pattern === 'string' 
          ? serverMessage.toLowerCase().includes(m.pattern.toLowerCase())
          : m.pattern.test(serverMessage)
      )

      if (mapping) {
        return mapping.userMessage
      }
      
      // Return server message if no mapping found
      return serverMessage
    }
    
    // PRIORITY 3: Handle other axios error cases
    if (error.response?.statusText) {
      message = `${error.response.statusText}. Silakan coba lagi.`
    } else if (error.code === 'ERR_BRANCH_REQUIRED') {
      message = 'Silakan pilih branch terlebih dahulu untuk mengakses fitur ini.'
    } else if (!error.response) {
      // Handle network errors
      message = 'Tidak dapat terhubung ke server. Silakan cek koneksi internet Anda.'
    } else {
      message = error.message || 'Terjadi kesalahan pada server'
    }
  } else if (error instanceof Error) {
    // Try to match error message with our mappings
    const mapping = ERROR_MAPPINGS.find(m => 
      typeof m.pattern === 'string' 
        ? error.message.toLowerCase().includes(m.pattern.toLowerCase())
        : m.pattern.test(error.message)
    )

    if (mapping) {
      return mapping.userMessage
    }
    
    message = error.message
  }
  
  return message
}

interface Pagination {
  page: number
  limit: number
  total: number
}

interface BankStatementImportState {
  // Data
  imports: BankStatementImport[]
  currentImport: BankStatementImport | null
  analyzeResult: BankStatementAnalysisResult | null

  // UI state
  selectedIds: Set<number>
  pagination: Pagination
  filters: BankStatementImportFilters

  loading: {
    list: boolean
    upload: boolean
    confirm: boolean
    delete: boolean
    retry: boolean
  }

  errors: {
    upload: string | null
    confirm: string | null
    general: string | null
  }

  uploadProgress: number
  showUploadModal: boolean
  showAnalysisModal: boolean
  showConfirmModal: boolean

  // Actions
  fetchImports: (params?: { page?: number; limit?: number; filters?: BankStatementImportFilters }) => Promise<void>
  uploadFile: (file: File, bankAccountId: string) => Promise<void>
  confirmImport: (skipDuplicates: boolean) => Promise<void>
  cancelImport: (id: number) => Promise<void>
  retryImport: (id: number) => Promise<void>
  deleteImport: (id: number) => Promise<void>

  toggleSelection: (id: number) => void
  selectAll: (ids: number[]) => void
  clearSelection: () => void

  setFilters: (filters: BankStatementImportFilters) => void
  setPagination: (page: number, limit?: number) => void

  openUploadModal: () => void
  closeUploadModal: () => void
  openAnalysisModal: () => void
  closeAnalysisModal: () => void
  openConfirmModal: () => void
  closeConfirmModal: () => void

  setCurrentImport: (imp: BankStatementImport | null) => void
  clearAnalyzeResult: () => void
  clearError: (type?: keyof BankStatementImportState['errors']) => void
}

const initialState: Pick<
  BankStatementImportState,
  | 'imports'
  | 'currentImport'
  | 'analyzeResult'
  | 'selectedIds'
  | 'pagination'
  | 'filters'
  | 'loading'
  | 'errors'
  | 'uploadProgress'
  | 'showUploadModal'
  | 'showAnalysisModal'
  | 'showConfirmModal'
> = {
  imports: [],
  currentImport: null,
  analyzeResult: null,
  selectedIds: new Set<number>(),
  pagination: {
    page: 1,
    limit: BANK_STATEMENT_IMPORT_PAGE_SIZE,
    total: 0,
  },
  filters: {},
  loading: {
    list: false,
    upload: false,
    confirm: false,
    delete: false,
    retry: false,
  },
  errors: {
    upload: null,
    confirm: null,
    general: null,
  },
  uploadProgress: 0,
  showUploadModal: false,
  showAnalysisModal: false,
  showConfirmModal: false,
}

export const useBankStatementImportStore = create<BankStatementImportState>((set, get) => ({
  ...initialState,

  fetchImports: async (params) => {
    set({
      loading: { ...get().loading, list: true },
      errors: { ...get().errors, general: null },
    })
    try {
      const { page = get().pagination.page, limit = get().pagination.limit, filters = get().filters } = params || {}
      const response = await bankStatementImportApi.list({ page, limit, ...filters })

      // API returns: { data: [...], total, page, limit, totalPages, hasNext, hasPrev }
      set({
        imports: response.data || [],
        pagination: {
          page: response.page || page,
          limit: response.limit || limit,
          total: response.total || 0,
        },
        loading: { ...get().loading, list: false },
      })
    } catch (error) {
      set({
        errors: {
          ...get().errors,
          general: getErrorMessage(error),
        },
        loading: { ...get().loading, list: false },
      })
    }
  },

  uploadFile: async (file: File, bankAccountId: string) => {
    set({
      loading: { ...get().loading, upload: true },
      errors: { ...get().errors, upload: null },
      uploadProgress: 0,
    })

    try {
      const result = await bankStatementImportApi.upload(file, bankAccountId, (progress) => {
        set({ uploadProgress: progress })
      })

      set({
        analyzeResult: result,
        currentImport: result.import,
        loading: { ...get().loading, upload: false },
        showAnalysisModal: true,
      })
    } catch (error) {
      set({
        errors: {
          ...get().errors,
          upload: getErrorMessage(error),
        },
        loading: { ...get().loading, upload: false },
      })
      throw error
    }
  },

  confirmImport: async (skipDuplicates: boolean) => {
    const currentImport = get().currentImport
    if (!currentImport) return

    set({
      loading: { ...get().loading, confirm: true },
      errors: { ...get().errors, confirm: null },
    })

    try {
      await bankStatementImportApi.confirm(currentImport.id, { skip_duplicates: skipDuplicates })

      // Refresh list
      await get().fetchImports()

      set({
        loading: { ...get().loading, confirm: false },
        showAnalysisModal: false,
        showConfirmModal: false,
      })
    } catch (error) {
      set({
        errors: {
          ...get().errors,
          confirm: getErrorMessage(error),
        },
        loading: { ...get().loading, confirm: false },
      })
      throw error
    }
  },

  cancelImport: async (id: number) => {
    set({ loading: { ...get().loading, confirm: true } })
    try {
      await bankStatementImportApi.cancel(id)
      await get().fetchImports()
    } finally {
      set({ loading: { ...get().loading, confirm: false } })
    }
  },

  retryImport: async (id: number) => {
    set({ loading: { ...get().loading, retry: true } })
    try {
      await bankStatementImportApi.retry(id)
      await get().fetchImports()
    } finally {
      set({ loading: { ...get().loading, retry: false } })
    }
  },

  deleteImport: async (id: number) => {
    set({ loading: { ...get().loading, delete: true } })
    try {
      await bankStatementImportApi.delete(id)
      await get().fetchImports()
    } finally {
      set({ loading: { ...get().loading, delete: false } })
    }
  },

  toggleSelection: (id: number) => {
    const selected = new Set(get().selectedIds)
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      selected.add(id)
    }
    set({ selectedIds: selected })
  },

  selectAll: (ids: number[]) => {
    set({ selectedIds: new Set(ids) })
  },

  clearSelection: () => {
    set({ selectedIds: new Set<number>() })
  },

  setFilters: (filters) => {
    set({ filters })
    get().fetchImports({ page: 1, filters })
  },

  setPagination: (page, limit) => {
    set({
      pagination: {
        ...get().pagination,
        page,
        limit: limit ?? get().pagination.limit,
      },
    })
    get().fetchImports({ page, limit })
  },

  openUploadModal: () => set({ showUploadModal: true }),
  closeUploadModal: () => set({ showUploadModal: false }),
  openAnalysisModal: () => set({ showAnalysisModal: true }),
  closeAnalysisModal: () => set({ showAnalysisModal: false }),
  openConfirmModal: () => set({ showConfirmModal: true }),
  closeConfirmModal: () => set({ showConfirmModal: false }),

  setCurrentImport: (imp) => set({ currentImport: imp }),
  clearAnalyzeResult: () => set({ analyzeResult: null }),
  clearError: (type) => {
    if (!type) {
      set({
        errors: {
          upload: null,
          confirm: null,
          general: null,
        },
      })
    } else {
      set({
        errors: {
          ...get().errors,
          [type]: null,
        },
      })
    }
  },
}))

