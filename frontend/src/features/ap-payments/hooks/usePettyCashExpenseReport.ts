import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface PettyCashExpenseReportRow {
  id: string
  request_id: string
  request_number: string
  request_status: 'PENDING' | 'DISBURSED' | 'CLOSED' | 'REJECTED'
  branch_name: string
  expense_date: string
  amount: number
  description: string | null
  category_name: string
  category_code: string
  sub_category_name: string | null
  affects_inventory: boolean
  product_name: string | null
  petty_cash_coa_name: string
  request_total_disbursed: number
  request_remaining: number
  settlement_status: 'SETTLED' | null
}

export interface PettyCashReportParams {
  branch_id?: string
  date_from?: string
  date_to?: string
  search?: string
  limit?: number
}

export function usePettyCashExpenseReport(
  params: PettyCashReportParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['petty-cash', 'report', 'expenses', params],
    queryFn: async () => {
      const { data } = await api.get('/petty-cash/report/expenses', { params })
      return {
        data: data.data as PettyCashExpenseReportRow[],
        pagination: data.pagination,
      }
    },
    enabled: options?.enabled ?? true,
  })
}
