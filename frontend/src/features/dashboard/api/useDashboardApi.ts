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
        void_transaction_count: number
        total_fee_amount: number
        status: string
        is_reconciled: boolean
        skip_reason: string | null
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

// All branches (for sync alert cross-check)
export const useAllBranches = () =>
  useQuery({
    queryKey: ['dashboard', 'all-branches'],
    queryFn: async () => {
      const { data } = await api.get('/branches', { params: { limit: 200, status: 'active' } })
      return data.data as Array<{ id: string; branch_name: string; status: string }>
    },
    staleTime: 5 * 60_000,
  })

// Bank accounts with owner = company (for statement status)
export const useBankAccountsList = (companyId: string | undefined) =>
  useQuery({
    queryKey: ['dashboard', 'bank-accounts', companyId],
    queryFn: async () => {
      const { data } = await api.get('/bank-accounts', {
        params: { owner_type: 'company', owner_id: companyId },
      })
      return data.data as Array<{
        id: number
        bank_name: string
        account_name: string
        account_number: string
        is_active: boolean
      }>
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

// Bank statement imports — recent (for checking which accounts have imports)
export const useRecentBankStatementImports = () => {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return useQuery({
    queryKey: ['dashboard', 'bank-statement-imports-month', monthStart],
    queryFn: async () => {
      const { data } = await api.get('/bank-statement-imports', {
        params: { page: 1, limit: 100, date_from: monthStart, date_to: today },
      })
      const payload = data.data
      const list = Array.isArray(payload) ? payload : (payload?.data ?? [])
      return list as Array<{
        id: number
        bank_account_id: number
        status: string
        created_at: string
        total_entries: number
      }>
    },
    staleTime: 5 * 60_000,
  })
}

// Fiscal periods — current year
export const useFiscalPeriodsStatus = () =>
  useQuery({
    queryKey: ['dashboard', 'fiscal-periods'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/fiscal-periods', {
        params: { fiscal_year: new Date().getFullYear(), limit: 20 },
      })
      return data.data as Array<{
        id: string
        period: string
        period_start: string
        period_end: string
        is_open: boolean
        fiscal_year: number
      }>
    },
    staleTime: 5 * 60_000,
  })

// Failed transactions count
export const useFailedTransactionsCount = () =>
  useQuery({
    queryKey: ['dashboard', 'failed-trx-count'],
    queryFn: async () => {
      const { data } = await api.get('/aggregated-transactions/failed', {
        params: { page: 1, limit: 1 },
      })
      return (data.pagination?.total as number) || 0
    },
    staleTime: 60_000,
  })
