export type GoodsReceiptStatus = 'DRAFT' | 'CONFIRMED'
export type GoodsReceiptSource = 'SUPPLIER' | 'MARKETPLACE'
export type VarianceStatus = 'OK' | 'NOTICE' | 'DISPUTED'

export interface GoodsReceipt {
  id: string
  company_id: string
  branch_id: string
  po_id: string
  warehouse_id: string
  gr_number: string
  status: GoodsReceiptStatus
  source: GoodsReceiptSource
  received_date: string
  invoice_number: string | null
  invoice_date: string | null
  journal_id: string | null
  notes: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface GoodsReceiptWithRelations extends GoodsReceipt {
  branch_name: string
  branch_code: string
  po_number: string
  supplier_name: string
  warehouse_name: string
  created_by_name: string | null
  confirmed_by_name?: string | null
  line_count: number
  total_invoice_amount: number
  weighing_line_count: number
  weighing_summary: string | null
}

export interface GoodsReceiptLine {
  id: string
  gr_id: string
  po_line_id: string
  product_id: string
  qty_po_uom: number
  uom_po: string
  qty_received: number
  uom_received: string
  conversion_factor: number
  unit_price_invoice: number
  total_price_invoice: number
  unit_price_po: number
  price_variance: number
  price_variance_pct: number
  variance_status: VarianceStatus
  notes: string | null
  qty_rejected: number
  reject_reason: string | null
}

export interface GoodsReceiptLineWithRelations extends GoodsReceiptLine {
  product_code: string
  product_name: string
  uom: string // PO line uom (legacy, kept for compat)
}

export interface GoodsReceiptWithLines extends GoodsReceiptWithRelations {
  lines: GoodsReceiptLineWithRelations[]
}

// DTOs
export interface CreateGoodsReceiptLineDto {
  po_line_id: string
  product_id: string
  qty_po_uom?: number
  qty_received: number
  uom_received?: string
  qty_rejected?: number
  reject_reason?: string | null
  unit_price_invoice: number
  notes?: string | null
}

export interface CreateGoodsReceiptDto {
  po_id: string
  warehouse_id: string
  received_date?: string
  invoice_number?: string | null
  invoice_date?: string | null
  notes?: string | null
  lines: CreateGoodsReceiptLineDto[]
  created_by?: string
}

export interface UpdateGoodsReceiptDto {
  warehouse_id?: string
  received_date?: string
  invoice_number?: string | null
  invoice_date?: string | null
  notes?: string | null
  lines?: CreateGoodsReceiptLineDto[]
  updated_by?: string
}
