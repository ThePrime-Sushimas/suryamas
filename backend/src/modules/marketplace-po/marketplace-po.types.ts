import { z } from 'zod'
import {
  listMarketplaceSessionsSchema,
  marketplaceSessionIdSchema,
  createMarketplaceSessionSchema,
  updateMarketplaceSessionSchema,
  cancelMarketplaceSessionSchema,
  orderMarketplaceSessionSchema,
  shipMarketplaceSessionSchema,
  receiveMarketplaceSessionSchema,
  settleMarketplaceSessionSchema,
  uploadMarketplaceAttachmentSchema,
  deleteMarketplaceAttachmentSchema,
  bulkSettleMarketplaceSessionSchema,
} from './marketplace-po.schema'

export type MarketplacePlatform = 'SHOPEE' | 'TOKOPEDIA'
export type MarketplaceSessionStatus = 'DRAFT' | 'ORDERED' | 'SHIPPED' | 'RECEIVED' | 'SETTLED' | 'CANCELLED'

export const marketplacePlatformSchema = z.enum(['SHOPEE', 'TOKOPEDIA'])
export const marketplaceSessionStatusSchema = z.enum(['DRAFT', 'ORDERED', 'SHIPPED', 'RECEIVED', 'SETTLED', 'CANCELLED'])

export type OwnerCreditCard = {
  id: string
  company_id: string
  card_label: string
  bank_name: string
  last4: string | null
  coa_code: string
  settlement_bank_account_id: number | null
  is_active: boolean
  sort_order: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** List/detail response — settlement bank joined when configured */
export type OwnerCreditCardWithSettlement = OwnerCreditCard & {
  settlement_bank_account_name: string | null
  settlement_bank_account_number: string | null
  settlement_bank_name: string | null
}

export type MarketplaceCheckoutSession = {
  id: string
  company_id: string
  session_number: string
  platform: MarketplacePlatform
  cc_id: string
  checkout_date: string
  total_amount: number
  notes: string | null
  status: MarketplaceSessionStatus
  platform_order_ids: string[] | null
  platform_receipt_url: string | null
  journal_ordered_id: string | null
  journal_received_id: string | null
  journal_settled_id: string | null
  goods_receipt_id: string | null
  cancel_reason: string | null        // ← tambah
  platform_cancel_ref: string | null  // ← tambah
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type MarketplaceCheckoutLine = {
  id: string
  session_id: string
  po_id: string
  po_line_id: string
  branch_id: string
  product_id: string
  qty: number
  unit_price_netto: number
  total_netto: number
  platform_order_id: string | null
  platform_item_id: string | null
  notes: string | null
  created_at: string
}

export type MarketplaceAttachment = {
  id: string
  session_id: string
  file_type: 'BUKTI_BAYAR' | 'SCREENSHOT_CHECKOUT' | 'INVOICE_MARKETPLACE' | 'OTHER'
  file_path: string
  file_name: string | null
  file_size: number | null
  uploaded_by: string | null
  uploaded_at: string
}

export type MarketplaceShipment = {
  id: string
  session_id: string
  branch_id: string
  tracking_number: string | null
  courier: string | null
  shipped_at: string | null
  received_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type CreateOwnerCreditCardDto = {
  card_label: string
  bank_name: string
  last4?: string | null
  coa_code: string
  settlement_bank_account_id?: number | null
  sort_order?: number
  is_active?: boolean
}

export type UpdateOwnerCreditCardDto = Partial<CreateOwnerCreditCardDto>

export type OwnerCreditCardCreateRepoData = {
  card_label: string
  bank_name: string
  last4: string | null
  coa_code: string
  is_active: boolean
  sort_order: number
  settlement_bank_account_id: number | null
}

export type OwnerCreditCardUpdateRepoData = {
  card_label?: string
  bank_name?: string
  last4?: string | null
  coa_code?: string
  is_active?: boolean
  sort_order?: number
  settlement_bank_account_id?: number | null
}

export type CreateMarketplaceSessionDto = {
  platform: MarketplacePlatform
  cc_id: string
  checkout_date: string
  notes?: string | null
  lines: Array<{
    po_id: string
    po_line_id: string
    branch_id: string
    product_id: string
    qty: number
    unit_price_netto: number
    platform_order_id?: string | null
    platform_item_id?: string | null
    notes?: string | null
  }>
}

export type UpdateMarketplaceSessionDto = {
  platform?: MarketplacePlatform
  cc_id?: string
  checkout_date?: string
  notes?: string | null
}

export type OrderSessionDto = {
  platform_order_ids?: string[] | null
  platform_receipt_url?: string | null
  journal_date?: string
  reference?: string | null
}

export type ShipSessionDto = {
  shipments: Array<{
    branch_id: string
    tracking_number: string
    courier?: string | null
    shipped_at?: string | null
    notes?: string | null
  }>
}

export type ReceiveSessionDto = {
  journal_date?: string
}
export type CancelSessionDto = {
  cancel_reason: string
  platform_cancel_ref?: string | null
}
export type SettleSessionDto = {
  bank_account_id: string
  amount: number
  reference_number: string
  settled_date: string
  notes?: string | null
}

export type ListMarketplaceSessionsQuery = {
  platform?: MarketplacePlatform
  status?: MarketplaceSessionStatus
  branch_id?: string
  cc_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page: number
  limit: number
}

export type BulkSettleSessionReq = Request & {
  validated: {
    body: z.infer<typeof bulkSettleMarketplaceSessionSchema>['body']
  }
}