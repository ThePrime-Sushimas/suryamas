import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

// POS Sync Aggregates — live sales per branch/payment method
export const usePosSalesToday = (dateFrom: string, dateTo: string) =>
  useQuery({
    queryKey: ['dashboard', 'pos-sales', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get('/pos-sync-aggregates', {
        params: { date_from: dateFrom, date_to: dateTo, limit: 500 },
      })
      return data.data as Array<{
        id: string
        sales_date: string
        branch_name: string | null
        payment_methods: { id: number; name: string; payment_type: string } | null
        grand_total: number
        nett_amount: number
        transaction_count: number
        total_fee_amount: number
        status: string
        is_reconciled: boolean
      }>
    },
    enabled: !!dateFrom && !!dateTo,
    refetchInterval: 60_000,
  })

// Bank Reconciliation summary
export const useReconSummary = () =>
  useQuery({
    queryKey: ['dashboard', 'recon-summary'],
    queryFn: async () => {
      const { data } = await api.get('/reconciliation/bank/summary')
      return data.data as {
        total_statements: number
        reconciled_count: number
        unreconciled_count: number
        discrepancy_count: number
        reconciled_amount: number
        unreconciled_amount: number
      }
    },
  })

// Cash Count deposits pending
export const useCashCountPending = () =>
  useQuery({
    queryKey: ['dashboard', 'cash-count-pending'],
    queryFn: async () => {
      const { data } = await api.get('/cash-counts/deposits', { params: { page: 1, limit: 5 } })
      const deposits = data.data || []
      const pendingCount = deposits.filter((d: { status: string }) => d.status === 'PENDING').length
      return { pendingCount, recentDeposits: deposits.slice(0, 3) }
    },
  })

// Basic stats
export const useDashboardStats = (companyId: string | undefined) =>
  useQuery({
    queryKey: ['dashboard', 'stats', companyId],
    queryFn: async () => {
      const [emp, prod] = await Promise.all([
        api.get('/employees', { params: { limit: 1 } }),
        api.get('/products', { params: { limit: 1 } }),
      ])
      return {
        employees: emp.data.pagination?.total || 0,
        products: prod.data.pagination?.total || 0,
      }
    },
    enabled: !!companyId,
  })
