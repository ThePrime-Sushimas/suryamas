import { create } from 'zustand'

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface IncomeStatementState {
  filter: {
    date_from: string
    date_to: string
    branch_ids: string[]
    compare_date_from: string
    compare_date_to: string
  }
  setFilter: (patch: Partial<IncomeStatementState['filter']>) => void
}

export const useIncomeStatementStore = create<IncomeStatementState>((set) => ({
  filter: {
    date_from: firstOfMonth(),
    date_to: today(),
    branch_ids: [],
    compare_date_from: '',
    compare_date_to: '',
  },
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
}))
