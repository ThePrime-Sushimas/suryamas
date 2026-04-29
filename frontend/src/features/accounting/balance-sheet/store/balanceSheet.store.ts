import { create } from 'zustand'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface BalanceSheetState {
  filter: {
    as_of_date: string
    branch_ids: string[]
    compare_as_of_date: string
  }
  setFilter: (patch: Partial<BalanceSheetState['filter']>) => void
}

export const useBalanceSheetStore = create<BalanceSheetState>((set) => ({
  filter: {
    as_of_date: today(),
    branch_ids: [],
    compare_as_of_date: '',
  },
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
}))
