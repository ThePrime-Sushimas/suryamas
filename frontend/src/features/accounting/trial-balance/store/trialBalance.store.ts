import { create } from 'zustand'
import type { TrialBalanceFilter } from '../types/trial-balance.types'

// ============================================================
// Filter State (Zustand)
// ============================================================

const now = new Date()
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  .toISOString()
  .split('T')[0]
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  .toISOString()
  .split('T')[0]

interface TrialBalanceFilterState {
  filter: TrialBalanceFilter
  setFilter: (patch: Partial<TrialBalanceFilter>) => void
  resetFilter: (companyId: string) => void
}

export const useTrialBalanceStore = create<TrialBalanceFilterState>((set) => ({
  filter: {
    company_id: '',
    date_from:  firstDay,
    date_to:    lastDay,
    branch_id:  undefined,
  },

  setFilter: (patch) =>
    set((state) => ({
      filter: { ...state.filter, ...patch },
    })),

  resetFilter: (companyId: string) =>
    set({
      filter: {
        company_id: companyId,
        date_from:  firstDay,
        date_to:    lastDay,
        branch_id:  undefined,
      },
    }),
}))
