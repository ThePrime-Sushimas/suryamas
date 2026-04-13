import { create } from 'zustand'
import { bankVouchersApi } from '../api/bankVouchers.api'
import type {
  BankVoucherFilter,
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankAccountOption,
  VoucherListResult,
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
  confirm: boolean
  list: boolean
  action: boolean // generic for void, manual create, opening balance
}

interface ErrorState {
  scope: string
  message: string
}

interface BankVouchersState {
  preview: BankVoucherPreviewResult | null
  summaryData: BankVoucherSummaryResult | null
  voucherList: VoucherListResult | null
  bankAccounts: BankAccountOption[]

  filter: BankVoucherFilter
  activeTab: ActiveTab
  expandedDates: Set<string>
  selectedDates: Set<string>

  loading: LoadingState
  error: ErrorState | null

  setFilter: (filter: Partial<BankVoucherFilter>) => void
  setActiveTab: (tab: ActiveTab) => void
  toggleDate: (date: string) => void
  expandAll: () => void
  collapseAll: () => void
  toggleSelectDate: (date: string) => void
  selectAllDates: () => void
  clearSelectedDates: () => void

  fetchPreview: () => Promise<void>
  fetchSummary: () => Promise<void>
  fetchBankAccounts: () => Promise<void>
  fetchList: () => Promise<void>
  fetchAll: () => Promise<void>

  confirmSelected: () => Promise<string[]>

  clearError: () => void
  reset: () => void
}

const initialLoading: LoadingState = {
  preview: false, summary: false, bankAccounts: false,
  confirm: false, list: false, action: false,
}

const initialState = {
  preview: null,
  summaryData: null,
  voucherList: null,
  bankAccounts: [],
  filter: defaultFilter,
  activeTab: 'voucher' as ActiveTab,
  expandedDates: new Set<string>(),
  selectedDates: new Set<string>(),
  loading: initialLoading,
  error: null,
}

export const useBankVouchersStore = create<BankVouchersState>((set, get) => ({
  ...initialState,

  setFilter: (newFilter) => {
    set(state => ({
      filter: { ...state.filter, ...newFilter },
      preview: null, summaryData: null, voucherList: null,
    }))
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleDate: (date) => {
    set(state => {
      const next = new Set(state.expandedDates)
      next.has(date) ? next.delete(date) : next.add(date)
      return { expandedDates: next }
    })
  },

  expandAll: () => {
    const { preview } = get()
    if (!preview) return
    set({ expandedDates: new Set(preview.vouchers.map(v => v.transaction_date)) })
  },

  collapseAll: () => set({ expandedDates: new Set() }),

  toggleSelectDate: (date) => {
    set(state => {
      const next = new Set(state.selectedDates)
      next.has(date) ? next.delete(date) : next.add(date)
      return { selectedDates: next }
    })
  },

  selectAllDates: () => {
    const { preview } = get()
    if (!preview) return
    const unconfirmed = preview.vouchers.filter(v => !v.is_confirmed).map(v => v.transaction_date)
    set({ selectedDates: new Set(unconfirmed) })
  },

  clearSelectedDates: () => set({ selectedDates: new Set() }),

  fetchPreview: async () => {
    const { filter } = get()
    set(s => ({ loading: { ...s.loading, preview: true }, error: null }))
    try {
      const data = await bankVouchersApi.preview(filter)
      set(s => ({
        preview: data,
        expandedDates: new Set(data.vouchers.map(v => v.transaction_date)),
        loading: { ...s.loading, preview: false },
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data voucher'
      set(s => ({ loading: { ...s.loading, preview: false }, error: { scope: 'preview', message } }))
    }
  },

  fetchSummary: async () => {
    const { filter } = get()
    set(s => ({ loading: { ...s.loading, summary: true }, error: null }))
    try {
      const data = await bankVouchersApi.summary({
        period_month: filter.period_month,
        period_year: filter.period_year,
        branch_id: filter.branch_id,
      })
      set(s => ({ summaryData: data, loading: { ...s.loading, summary: false } }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat ringkasan'
      set(s => ({ loading: { ...s.loading, summary: false }, error: { scope: 'summary', message } }))
    }
  },

  fetchBankAccounts: async () => {
    set(s => ({ loading: { ...s.loading, bankAccounts: true } }))
    try {
      const data = await bankVouchersApi.getBankAccounts()
      set(s => ({ bankAccounts: data, loading: { ...s.loading, bankAccounts: false } }))
    } catch {
      set(s => ({ loading: { ...s.loading, bankAccounts: false } }))
    }
  },

  fetchList: async () => {
    const { filter } = get()
    set(s => ({ loading: { ...s.loading, list: true }, error: null }))
    try {
      const data = await bankVouchersApi.list(filter)
      set(s => ({ voucherList: data, loading: { ...s.loading, list: false } }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat daftar voucher'
      set(s => ({ loading: { ...s.loading, list: false }, error: { scope: 'list', message } }))
    }
  },

  fetchAll: async () => {
    const { activeTab } = get()
    const promises: Promise<void>[] = [get().fetchPreview(), get().fetchSummary()]
    if (activeTab === 'list') promises.push(get().fetchList())
    await Promise.all(promises)
  },

  confirmSelected: async () => {
    const { filter, selectedDates } = get()
    if (selectedDates.size === 0) return []

    set(s => ({ loading: { ...s.loading, confirm: true }, error: null }))
    try {
      const result = await bankVouchersApi.confirm({
        transaction_dates: Array.from(selectedDates),
        branch_id: filter.branch_id,
        bank_account_id: filter.bank_account_id,
      })
      set(s => ({ loading: { ...s.loading, confirm: false }, selectedDates: new Set() }))
      // Refresh data
      await get().fetchAll()
      return result.voucher_numbers
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal konfirmasi voucher'
      set(s => ({ loading: { ...s.loading, confirm: false }, error: { scope: 'confirm', message } }))
      throw err
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
