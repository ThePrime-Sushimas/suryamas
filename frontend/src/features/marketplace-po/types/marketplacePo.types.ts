export type MarketplacePlatform = 'SHOPEE' | 'TOKOPEDIA'
export type MarketplaceSessionStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'SHIPPED'
  | 'RECEIVED'
  | 'SETTLED'
  | 'CANCELLED'

export type MarketplaceAttachmentType =
  | 'BUKTI_BAYAR'
  | 'SCREENSHOT_CHECKOUT'
  | 'INVOICE_MARKETPLACE'
  | 'OTHER'

export interface OwnerCreditCard {
  id: string
  company_id: string
  card_label: string
  bank_name: string
  last4: string | null
  coa_code: string
  /** null = belum dikonfigurasi; omitted on legacy responses */
  settlement_bank_account_id?: number | null
  is_active: boolean
  sort_order: number
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
  /** Populated on list/create/update when settlement bank is joined */
  settlement_bank_account_name?: string | null
  settlement_bank_account_number?: string | null
  settlement_bank_name?: string | null
}

/** API list/detail/create/update response */
export type OwnerCreditCardResponse = OwnerCreditCard & {
  settlement_bank_account_name: string | null
  settlement_bank_account_number: string | null
  settlement_bank_name: string | null
}

export type CreateOwnerCreditCardPayload = {
  card_label: string
  bank_name: string
  last4?: string | null
  coa_code: string
  settlement_bank_account_id?: number | null
  is_active?: boolean
  sort_order?: number
}

export type UpdateOwnerCreditCardPayload = Partial<CreateOwnerCreditCardPayload>

export interface MarketplaceCheckoutSession {
  id: string
  company_id?: string
  session_number: string
  platform: MarketplacePlatform
  cc_id: string
  cc_label?: string
  /** Default settlement bank from owner credit card settings */
  cc_settlement_bank_account_id?: number | null
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
  gp_id: string | null        // ← tambah
  gp_status: string | null    // ← tambah
  gp_number: string | null    // ← tambah
  cancel_reason: string | null        // ← tambah
  platform_cancel_ref: string | null  // ← tambah
  created_by_name?: string
  created_at: string
  updated_at: string
  card_label?: string
  coa_code?: string
  bank_name?: string
  last4?: string | null
}

export interface MarketplaceCheckoutLine {
  id: string
  session_id: string
  po_id: string
  po_number?: string
  po_line_id: string
  branch_id: string
  branch_name?: string
  product_id: string
  product_name?: string
  product_code?: string
  qty: number
  unit_price_netto: number
  total_netto: number
  platform_order_id: string | null
  notes: string | null
  status?: 'ACTIVE' | 'CANCELLED'
  cancelled_at?: string | null
  cancel_reason?: string | null
  correction_journal_id?: string | null
}

export interface MarketplaceShipment {
  id: string
  session_id: string
  branch_id: string
  branch_name?: string
  tracking_number: string | null
  courier: string | null
  shipped_at: string | null
  received_at: string | null
  notes?: string | null
}

export interface MarketplaceAttachment {
  id: string
  session_id: string
  file_type: MarketplaceAttachmentType
  file_path: string
  file_name: string | null
  file_size?: number | null
  uploaded_at: string
}

export interface PendingPoLine {
  po_line_id: string
  po_id: string
  product_id: string
  qty: number
  qty_received: number
  uom: string
  unit_price: number
  po_number: string
  branch_id: string
  branch_name: string
  supplier_name: string
  product_name: string
  product_code: string
}

export interface MarketplaceSessionDetail {
  header: MarketplaceCheckoutSession
  lines: MarketplaceCheckoutLine[]
  shipments: MarketplaceShipment[]
  attachments: MarketplaceAttachment[]
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SelectedLine {
  po_line_id: string
  po_id: string
  branch_id: string
  product_id: string
  qty: number
  unit_price_netto: number
}
