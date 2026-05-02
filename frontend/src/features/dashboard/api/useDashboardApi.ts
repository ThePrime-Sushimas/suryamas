import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

// POS Sync Aggregates — live sales per branch/payment method
// Uses fields=slim to reduce egress (~60-70% less data)
// dateFrom is extended to include yesterday for delta calculation (single query)

type SalesRow = {
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
}

export const fmtD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return fmtD(d)
}

const todayStr = () => fmtD(new Date())

export const usePosSalesRange = (dateFrom: string, dateTo: string) => {
  const extendedFrom = dateFrom ? dayBefore(dateFrom) : ''
  const includesLive = dateTo >= todayStr()

  return useQuery({
    queryKey: ['dashboard', 'pos-sales', extendedFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get('/pos-sync-aggregates', {
        params: { date_from: extendedFrom, date_to: dateTo, limit: 500, fields: 'slim' },
      })
      return data.data as SalesRow[]
    },
    enabled: !!dateFrom && !!dateTo,
    refetchInterval: includesLive ? 60_000 : false,
    staleTime: includesLive ? 30_000 : 30 * 60_000,
  })
}

// Bank Reconciliation summary
export const useReconSummary = (startDateOverride?: string, endDateOverride?: string) => {
  const now = new Date()
  const startDate = startDateOverride ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = endDateOverride ?? fmtD(now)

  return useQuery({
    queryKey: ['dashboard', 'recon-summary', startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get('/reconciliation/bank/summary', {
        params: { startDate, endDate },
      })
      const d = data.data as Record<string, number>
      return {
        total_statements: d.totalStatements ?? 0,
        reconciled_count: d.totalStatements ? (d.totalStatements - (d.unreconciled ?? 0)) : 0,
        unreconciled_count: d.unreconciled ?? 0,
        discrepancy_count: d.discrepancies ?? 0,
        reconciled_amount: 0,
        unreconciled_amount: d.totalDifference ?? 0,
      }
    },
    staleTime: 2 * 60_000,
  })
}

// Cash Count stats
export const useCashCountPending = () =>
  useQuery({
    queryKey: ['dashboard', 'cash-count-pending'],
    queryFn: async () => {
      const [depositRes, countRes] = await Promise.all([
        api.get('/cash-counts/deposits', { params: { page: 1, limit: 5 } }),
        api.get('/cash-counts', { params: { page: 1, limit: 1 } }),
      ])
      const deposits = depositRes.data.data || []
      const pendingDeposits = deposits.filter((d: { status: string }) => d.status === 'PENDING').length
      const totalCashCounts = countRes.data.pagination?.total || 0
      const countedNotDeposited = (countRes.data.data || []).filter((c: { status: string }) => c.status === 'COUNTED').length
      return {
        pendingCount: pendingDeposits,
        countedNotDeposited,
        totalCashCounts,
      }
    },
    staleTime: 2 * 60_000,
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
      const { data } = await api.get('/branches', { params: { limit: 200 } })
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
  })

// Journal summary — count by status, optionally filtered by date range
export const useJournalSummary = (dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ['dashboard', 'journal-summary', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const { data } = await api.get('/accounting/journals/status-counts', { params })
      const counts = data.data as Record<string, number>
      return {
        total: Object.values(counts).reduce((s, c) => s + c, 0),
        posted: counts.POSTED || 0,
        draft: counts.DRAFT || 0,
        approved: counts.APPROVED || 0,
        submitted: counts.SUBMITTED || 0,
        rejected: counts.REJECTED || 0,
        reversed: counts.REVERSED || 0,
      }
    },
    staleTime: 3 * 60_000,
  })

// Fee discrepancy summary
export const useFeeDiscrepancySummary = (dateFrom: string, dateTo: string) => {
  const feeApi = import('@/features/bank-reconciliation/fee-discrepancy-review/api/fee-discrepancy.api')
  return useQuery({
    queryKey: ['dashboard', 'fee-discrepancy-summary', dateFrom, dateTo],
    queryFn: async () => {
      const { feeDiscrepancyApi } = await feeApi
      return feeDiscrepancyApi.summary({ dateFrom, dateTo })
    },
    enabled: !!dateFrom && !!dateTo,
    retry: false,
    staleTime: 3 * 60_000,
  })
}

// Expense categorization stats
export const useExpenseCategorizeStats = (dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ['dashboard', 'expense-categorize-stats', dateFrom, dateTo],
    queryFn: async () => {
      const baseParams = { limit: 1, ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }
      const [uncatRes, totalRes] = await Promise.all([
        api.get('/expense-categorization/uncategorized', { params: { ...baseParams, categorized: 'false' } }),
        api.get('/expense-categorization/uncategorized', { params: baseParams }),
      ])
      const uncategorized = uncatRes.data.pagination?.total ?? 0
      const totalUnjournaled = totalRes.data.pagination?.total ?? 0
      return { uncategorized, unjournaled: totalUnjournaled, categorized: totalUnjournaled - uncategorized }
    },
    staleTime: 3 * 60_000,
  })

// Balance Sheet health check
export const useBalanceSheetHealth = (companyId: string | undefined, asOfDate?: string) =>
  useQuery({
    queryKey: ['dashboard', 'balance-sheet-health', companyId, asOfDate],
    queryFn: async () => {
      const date = asOfDate || fmtD(new Date())
      const { data } = await api.get('/accounting/balance-sheet', {
        params: { as_of_date: date },
      })
      const summary = data.data?.summary
      return {
        is_balanced: summary?.is_balanced ?? true,
        total_asset: Number(summary?.total_asset ?? 0),
        total_liability_equity: Number(summary?.total_liability_equity ?? 0),
        difference: Number(summary?.total_asset ?? 0) - Number(summary?.total_liability_equity ?? 0),
      }
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })
