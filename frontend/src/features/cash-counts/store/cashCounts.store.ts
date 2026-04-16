import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Tab = 'counts' | 'deposits' | 'capital_report'

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function getMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

interface CashCountsFilterState {
  activeTab: Tab
  startDate: string
  endDate: string
  paymentMethodId: number
  depositsPage: number

  setActiveTab: (tab: Tab) => void
  setStartDate: (date: string) => void
  setEndDate: (date: string) => void
  setPaymentMethodId: (id: number) => void
  setDepositsPage: (page: number) => void
  resetFilter: () => void
}

export const useCashCountsStore = create<CashCountsFilterState>()(
  persist(
    (set) => ({
      activeTab: 'counts',
      startDate: getMonthStart(),
      endDate: getYesterday(),
      paymentMethodId: 0,
      depositsPage: 1,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setStartDate: (date) => set({ startDate: date }),
      setEndDate: (date) => set({ endDate: date }),
      setPaymentMethodId: (id) => set({ paymentMethodId: id }),
      setDepositsPage: (page) => set({ depositsPage: page }),
      resetFilter: () => set({
        activeTab: 'counts',
        startDate: getMonthStart(),
        endDate: getYesterday(),
        paymentMethodId: 0,
        depositsPage: 1,
      }),
    }),
    {
      name: 'cash-counts-filter',
      partialize: (state) => ({
        activeTab: state.activeTab,
        startDate: state.startDate,
        endDate: state.endDate,
        paymentMethodId: state.paymentMethodId,
        depositsPage: state.depositsPage,
      }),
    }
  )
)
