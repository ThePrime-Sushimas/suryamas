import { create } from 'zustand'
import { bankVouchersApi } from '../api/bankVouchers.api'
import type {
  BankVoucherFilter,
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankAccountOption,
  ActiveTab,
} from '../types/bank-vouchers.types'

const now = new Date()
const defaultFilter: BankVoucherFilter = {
  period_month: now.getMonth() + 1,
  period_year: now.getFullYear(),
}

interface LoadingState {
  preview: boolean
  summary: boolean
  bankAccounts: boolean
  // Phase 2: confirm: boolean
}

interface ErrorState {
  scope: 'preview' | 'summary' | 'bankAccounts'
  message: string
}

interface BankVouchersState {
  // Data
  preview: BankVoucherPreviewResult | null
  summaryData: BankVoucherSummaryResult | null
  bankAccounts: BankAccountOption[]

  // UI
  filter: BankVoucherFilter
  activeTab: ActiveTab
  expandedDates: Set<string>

  // Status
  loading: LoadingState
  error: ErrorState | null

  // Actions
  setFilter: (filter: Partial<BankVoucherFilter>) => void
  setActiveTab: (tab: ActiveTab) => void
  toggleDate: (date: string) => void
  expandAll: () => void
  collapseAll: () => void

  fetchPreview: () => Promise<void>
  fetchSummary: () => Promise<void>
  fetchBankAccounts: () => Promise<void>
  fetchAll: () => Promise<void>

  // Phase 2: confirmVouchers: (dates: string[]) => Promise<void>

  clearError: () => void
  reset: () => void
}

const initialState = {
  preview: null,
  summaryData: null,
  bankAccounts: [],
  filter: defaultFilter,
  activeTab: 'voucher' as ActiveTab,
  expandedDates: new Set<string>(),
  loading: { preview: false, summary: false, bankAccounts: false },
  error: null,
}

export const useBankVouchersStore = create<BankVouchersState>((set, get) => ({
  ...initialState,

  setFilter: (newFilter) => {
    set(state => ({
      filter: { ...state.filter, ...newFilter },
      preview: null,
      summaryData: null,
    }))
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleDate: (date) => {
    set(state => {
      const next = new Set(state.expandedDates)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return { expandedDates: next }
    })
  },

  expandAll: () => {
    const { preview } = get()
    if (!preview) return
    set({ expandedDates: new Set(preview.vouchers.map(v => v.transaction_date)) })
  },

  collapseAll: () => set({ expandedDates: new Set() }),

  fetchPreview: async () => {
    const { filter } = get()
    set(state => ({ loading: { ...state.loading, preview: true }, error: null }))
    try {
      const data = await bankVouchersApi.preview(filter)
      set(state => ({
        preview: data,
        expandedDates: new Set(data.vouchers.map(v => v.transaction_date)),
        loading: { ...state.loading, preview: false },
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data voucher'
      set(state => ({
        loading: { ...state.loading, preview: false },
        error: { scope: 'preview', message },
      }))
    }
  },

  fetchSummary: async () => {
    const { filter } = get()
    set(state => ({ loading: { ...state.loading, summary: true }, error: null }))
    try {
      const data = await bankVouchersApi.summary({
        period_month: filter.period_month,
        period_year: filter.period_year,
        branch_id: filter.branch_id,
      })
      set(state => ({ summaryData: data, loading: { ...state.loading, summary: false } }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat ringkasan'
      set(state => ({
        loading: { ...state.loading, summary: false },
        error: { scope: 'summary', message },
      }))
    }
  },

  fetchBankAccounts: async () => {
    set(state => ({ loading: { ...state.loading, bankAccounts: true } }))
    try {
      const data = await bankVouchersApi.getBankAccounts()
      set(state => ({ bankAccounts: data, loading: { ...state.loading, bankAccounts: false } }))
    } catch {
      set(state => ({ loading: { ...state.loading, bankAccounts: false } }))
    }
  },

  fetchAll: async () => {
    await Promise.all([get().fetchPreview(), get().fetchSummary()])
  },

  // ============================================
  // PHASE 2 (uncomment setelah backend confirm ready)
  // ============================================
  // confirmVouchers: async (dates) => {
  //   const { filter } = get()
  //   set(state => ({ loading: { ...state.loading, confirm: true }, error: null }))
  //   try {
  //     await bankVouchersApi.confirm({ dates, branch_id: filter.branch_id, bank_account_id: filter.bank_account_id })
  //     await get().fetchAll()
  //     set(state => ({ loading: { ...state.loading, confirm: false } }))
  //   } catch (err: unknown) {
  //     const message = err instanceof Error ? err.message : 'Gagal konfirmasi voucher'
  //     set(state => ({ loading: { ...state.loading, confirm: false }, error: { scope: 'preview', message } }))
  //     throw err
  //   }
  // },

  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))