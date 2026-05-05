import { create } from 'zustand'
import type { TrialBalanceFilter } from '../types/trial-balance.types'

function getLocalDate(): { firstDay: string; lastDay: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0)
  const lastStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { firstDay: first, lastDay: lastStr }
}

const { firstDay, lastDay } = getLocalDate()

interface TrialBalanceFilterState {
  filter: TrialBalanceFilter
  setFilter: (patch: Partial<TrialBalanceFilter>) => void
}

export const useTrialBalanceStore = create<TrialBalanceFilterState>((set) => ({
  filter: {
    company_id: '',
    date_from: firstDay,
    date_to: lastDay,
    branch_ids: [],
  },
  setFilter: (patch) =>
    set((state) => ({ filter: { ...state.filter, ...patch } })),
}))
