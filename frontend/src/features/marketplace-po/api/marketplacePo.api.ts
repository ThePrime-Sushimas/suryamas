import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  OwnerCreditCard,
  OwnerCreditCardResponse,
  CreateOwnerCreditCardPayload,
  UpdateOwnerCreditCardPayload,
  MarketplaceCheckoutSession,
  MarketplaceSessionDetail,
  PendingPoLine,
  MarketplacePlatform,
  MarketplaceSessionStatus,
  MarketplaceAttachmentType,
  Pagination,
} from '../types/marketplacePo.types'

const KEYS = {
  sessions: (params: Record<string, unknown>) => ['marketplace-sessions', params] as const,
  session: (id: string) => ['marketplace-sessions', id] as const,
  pendingLines: (params: Record<string, unknown>) =>
    ['marketplace-sessions', 'pending-po-lines', params] as const,
  ownerCards: (params?: Record<string, unknown>) => ['owner-credit-cards', params] as const,
}

// ── Owner Credit Cards ──

export function useOwnerCreditCards(params?: { is_active?: boolean }) {
  return useQuery({
    queryKey: KEYS.ownerCards(params ?? {}),
    queryFn: async () => {
      const { data } = await api.get('/owner-credit-cards', { params })
      return data.data as OwnerCreditCardResponse[]
    },
    staleTime: 60_000,
  })
}

export interface UnreconciledStatement {
  id: number
  transaction_date: string
  description: string
  debit_amount: string
  credit_amount: string
  reference_number: string | null
}

export function useUnreconciledStatements(params: {
  bank_account_id?: number
  date_from?: string
  date_to?: string
}) {
  return useQuery({
    queryKey: ['marketplace-settlements', 'unreconciled-statements', params],
    queryFn: async () => {
      const { data } = await api.get('/marketplace-settlements/unreconciled-statements', {
        params,
      })
      return data.data as UnreconciledStatement[]
    },
    enabled: !!params.bank_account_id,
    staleTime: 30_000,
  })
}

export function useCreateOwnerCreditCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateOwnerCreditCardPayload) => {
      const { data } = await api.post('/owner-credit-cards', body)
      return data.data as OwnerCreditCardResponse
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-credit-cards'] }),
  })
}

export function useUpdateOwnerCreditCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: { id: string } & UpdateOwnerCreditCardPayload) => {
      const { data } = await api.put(`/owner-credit-cards/${id}`, body)
      return data.data as OwnerCreditCardResponse
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-credit-cards'] }),
  })
}

export function useDeleteOwnerCreditCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/owner-credit-cards/${id}`)
      return data.data as OwnerCreditCard
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-credit-cards'] }),
  })
}

// ── Sessions ──

export function useMarketplaceSessions(params: {
  platform?: MarketplacePlatform
  status?: MarketplaceSessionStatus
  branch_id?: string
  cc_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: KEYS.sessions(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params.page ?? 1,
        limit: params.limit ?? 25,
      }
      if (params.platform) queryParams.platform = params.platform
      if (params.status) queryParams.status = params.status
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.cc_id) queryParams.cc_id = params.cc_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.search) queryParams.search = params.search
      const { data } = await api.get('/marketplace-sessions', { params: queryParams })
      return {
        data: data.data as MarketplaceCheckoutSession[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
    ...options,
  })
}

export function useMarketplaceSession(id: string) {
  return useQuery({
    queryKey: KEYS.session(id),
    queryFn: async () => {
      const { data } = await api.get(`/marketplace-sessions/${id}`)
      return data.data as MarketplaceSessionDetail
    },
    enabled: !!id,
  })
}
export function useCancelOrderedSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cancel_reason,
      platform_cancel_ref,
    }: {
      id: string
      cancel_reason: string
      platform_cancel_ref?: string | null
    }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/cancel-ordered`, {
        cancel_reason,
        platform_cancel_ref,
      })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-po-lines'] })
    },
  })
}

export function useCancelShippedSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cancel_reason,
      platform_cancel_ref,
    }: {
      id: string
      cancel_reason: string
      platform_cancel_ref?: string | null
    }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/cancel-shipped`, {
        cancel_reason,
        platform_cancel_ref,
      })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-po-lines'] })
    },
  })
}

export function useRemoveSessionLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, lineId }: { sessionId: string; lineId: string }) => {
      const { data } = await api.delete(`/marketplace-sessions/${sessionId}/lines/${lineId}`)
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.sessionId) })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-po-lines'] })
    },
  })
}

export function useCancelSessionLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sessionId,
      lineId,
      cancelReason,
    }: {
      sessionId: string
      lineId: string
      cancelReason: string
    }) => {
      const { data } = await api.post(`/marketplace-sessions/${sessionId}/lines/${lineId}/cancel`, {
        cancel_reason: cancelReason,
      })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.sessionId) })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-po-lines'] })
    },
  })
}
export function usePostReceiveJournal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, journal_date }: { id: string; journal_date?: string }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/post-receive-journal`, {
        journal_date,
      })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(KEYS.session(vars.id), data)
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
    },
  })
}
export function usePendingPoLines(params: { platform?: MarketplacePlatform; branch_id?: string }) {
  return useQuery({
    queryKey: KEYS.pendingLines(params),
    queryFn: async () => {
      const { data } = await api.get('/marketplace-sessions/pending-po-lines', { params })
      return data.data as PendingPoLine[]
    },
    enabled: !!params.platform,
    staleTime: 30_000,
  })
}

export function useCreateMarketplaceSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      platform: MarketplacePlatform
      cc_id: string
      checkout_date?: string
      notes?: string | null
      lines: Array<{
        po_id: string
        po_line_id: string
        branch_id: string
        product_id: string
        qty: number
        unit_price_netto: number
        platform_order_id?: string | null
      }>
    }) => {
      const { data } = await api.post('/marketplace-sessions', body)
      return data.data as MarketplaceCheckoutSession
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-po-lines'] })
    },
  })
}

export function useUpdateMarketplaceSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      platform?: MarketplacePlatform
      cc_id?: string
      checkout_date?: string
      notes?: string | null
    }) => {
      const { data } = await api.put(`/marketplace-sessions/${id}`, body)
      return data.data as MarketplaceCheckoutSession
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
    },
  })
}

export function useCancelMarketplaceSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/marketplace-sessions/${id}`)
      return data.data as MarketplaceCheckoutSession
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-po-lines'] })
    },
  })
}

// ── Transitions ──

export function useOrderSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      platform_order_ids?: string[]
      platform_receipt_url?: string | null
      journal_date?: string
    }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/order`, body)
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
    },
  })
}

// ── CC Settlements ──
export function usePendingMarketplaceSessions() {
  return useQuery<MarketplaceCheckoutSession[]>({
    queryKey: ['marketplace-sessions', 'pending-settlement'],
    queryFn: async () => {
      const { data } = await api.get('/marketplace-sessions', { params: { status: 'RECEIVED' } })
      return data.data
    },
    staleTime: 60_000,
  })
}

export function useCCOwnerSettlementSummary() {
  return useQuery({
    queryKey: ['marketplace-settlements', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/marketplace-settlements/summary')
      return data.data as {
        total_pending: number
        total_pending_general_invoices: number
        total_this_month: number
        history: any[]
      }
    },
    staleTime: 60_000,
  })
}

export interface PendingCcOwnerGiPayment {
  id: string
  payment_number: string
  invoice_number: string
  vendor_name: string
  total_amount: number
  payment_date: string | null
  paid_at: string | null
  owner_credit_card_id: string
  cc_label: string
  cc_id: string
}

export function usePendingCcOwnerGeneralInvoicePayments() {
  return useQuery<PendingCcOwnerGiPayment[]>({
    queryKey: ['marketplace-settlements', 'pending-general-invoices'],
    queryFn: async () => {
      const { data } = await api.get('/marketplace-settlements/pending-general-invoices')
      return data.data
    },
    staleTime: 60_000,
  })
}

export function useCreateBulkCCOwnerSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      session_ids: string[]
      general_invoice_payment_ids?: string[]
      bank_account_id: number
      amount: number
      reference_number: string
      settled_date: string
      notes?: string | null
      bank_statement_id?: number | null
    }) => {
      const { data } = await api.post('/marketplace-settlements/bulk', payload)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: ['marketplace-settlements'] })
      qc.invalidateQueries({ queryKey: ['marketplace-sessions', 'pending-settlement'] })
      qc.invalidateQueries({ queryKey: ['general-ap', 'payments'] })
      qc.invalidateQueries({ queryKey: ['general-ap', 'invoices'] })
    },
  })
}

export function useShipSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      shipments,
    }: {
      id: string
      shipments: Array<{
        branch_id: string
        tracking_number: string
        courier?: string | null
        shipped_at?: string | null
        notes?: string | null
      }>
    }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/shipments`, { shipments })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
    },
  })
}

export function useReceiveSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, journal_date }: { id: string; journal_date?: string }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/receive`, { journal_date })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}

export function useSettleSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      bank_account_id,
      amount,
      reference_number,
      settled_date,
      notes,
    }: {
      id: string
      bank_account_id: number
      amount: number
      reference_number: string
      settled_date?: string
      notes?: string | null
    }) => {
      const { data } = await api.post(`/marketplace-sessions/${id}/settle`, {
        bank_account_id,
        amount,
        reference_number,
        settled_date,
        notes,
      })
      return data.data as MarketplaceSessionDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-sessions'] })
      qc.invalidateQueries({ queryKey: KEYS.session(vars.id) })
    },
  })
}

// ── Attachments ──

export function useUploadMarketplaceAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sessionId,
      file,
      fileType,
    }: {
      sessionId: string
      file: File
      fileType: MarketplaceAttachmentType
    }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('file_type', fileType)
      const { data } = await api.post(`/marketplace-sessions/${sessionId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.session(vars.sessionId) })
    },
  })
}

export function useDeleteMarketplaceAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sessionId,
      attachmentId,
    }: {
      sessionId: string
      attachmentId: string
    }) => {
      await api.delete(`/marketplace-sessions/${sessionId}/attachments/${attachmentId}`)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.session(vars.sessionId) })
    },
  })
}

// ── Bank accounts (settle) ──

export interface BankAccountOption {
  id: number
  account_name: string
  account_number: string
  bank_name?: string
  coa_code?: string
  is_active?: boolean
}

/** Company bank accounts for settlement / owner CC settings */
export function useCompanyBankAccounts(companyId?: string) {
  return useQuery({
    queryKey: ['bank-accounts', 'company', companyId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, unknown> = { owner_type: 'company', is_active: true, limit: 200 }
      if (companyId) params.owner_id = companyId
      const { data } = await api.get('/bank-accounts', { params })
      return (data.data || []) as BankAccountOption[]
    },
    staleTime: 5 * 60_000,
  })
}

export interface CcCoaOption {
  account_code: string
  account_name: string
}

/** Fetch COA with a given code prefix (e.g. "2106" for owner CC). */
export function useCcCoaOptions() {
  return useQuery({
    queryKey: ['chart-of-accounts', 'by-code-prefix', '2106'],
    queryFn: async () => {
      const { data } = await api.get('/chart-of-accounts/by-code-prefix/2106')
      return (data.data ?? []) as CcCoaOption[]
    },
    staleTime: 5 * 60_000,
  })
}

export async function getSignedUrl(filePath: string) {
  const { data } = await api.get('/storage/signed-url', {
    params: { path: filePath, bucket: 'invoices' },
  })
  return data.data.url as string
}

export interface SessionGrSummary {
  id: string
  gr_number: string
  status: string
  branch_name: string
}

export function useMarketplaceSessionGrs(sessionNumber: string, enabled: boolean) {
  return useQuery({
    queryKey: ['marketplace-session-grs', sessionNumber],
    queryFn: async () => {
      const { data } = await api.get('/goods-receipts', {
        params: {
          invoice_number: sessionNumber,
          source: 'MARKETPLACE',
          limit: 10,
          page: 1,
        },
      })
      return (data.data ?? []) as SessionGrSummary[]
    },
    enabled: !!sessionNumber && enabled,
    staleTime: 30_000,
  })
}