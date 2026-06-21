import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { InventoryReconciliationFilter, InventoryReconciliationResult } from '../types/inventory-reconciliation.types'

export const inventoryReconciliationKeys = {
  all: ['inventory-reconciliation'] as const,
  data: (filter: InventoryReconciliationFilter) => [...inventoryReconciliationKeys.all, 'data', filter] as const,
}

export const useInventoryReconciliation = (filter: InventoryReconciliationFilter, enabled: boolean) =>
  useQuery({
    queryKey: inventoryReconciliationKeys.data(filter),
    queryFn: async () => {
      const params: Record<string, string> = {
        as_of_date: filter.as_of_date,
      }
      if (filter.branch_ids.length > 0) {
        params.branch_ids = filter.branch_ids.join(',')
      }
      const { data } = await api.get('/accounting/inventory-reconciliation', { params })
      const result = data.data as InventoryReconciliationResult
      return {
        ...result,
        reconciliation: result.reconciliation.map(r => ({
          ...r,
          subledger_value: Number(r.subledger_value),
          gl_balance: Number(r.gl_balance),
          variance: Number(r.variance),
          variance_pct: Number(r.variance_pct),
        })),
        unjournaled_waste: result.unjournaled_waste.map(r => ({
          ...r,
          unjournaled_waste_value: Number(r.unjournaled_waste_value),
          waste_line_count: Number(r.waste_line_count),
        })),
        unjournaled_shortage: (result.unjournaled_shortage ?? []).map(r => ({
          ...r,
          deduction_amount: Number(r.deduction_amount),
        })),
        total_subledger: Number(result.total_subledger),
        total_gl: Number(result.total_gl),
        total_variance: Number(result.total_variance),
      }
    },
    enabled: enabled && !!filter.as_of_date,
    staleTime: 60_000,
  })
