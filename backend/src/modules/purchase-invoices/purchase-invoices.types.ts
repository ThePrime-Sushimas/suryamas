export type PurchaseInvoiceStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED'

export interface PurchaseInvoice {
  id: string
  company_id: string
  supplier_id: string
  branch_id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: PurchaseInvoiceStatus
  notes: string | null
  rejection_reason: string | null
  subtotal: number
  total_tax: number
  total_amount: number
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  posted_by: string | null
  posted_at: string | null
  journal_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PurchaseInvoiceWithRelations extends PurchaseInvoice {
  supplier_name: string
  branch_name: string
  branch_code: string
  goods_receipt_count: number
}

export interface PurchaseInvoiceGrLink {
  id: string
  purchase_invoice_id: string
  goods_receipt_id: string
  goods_receipt_number: string | null
  received_date: string
  supplier_id: string
  supplier_name: string
}

export interface PurchaseInvoiceLine {
  id: string
  purchase_invoice_id: string
  gr_line_id: string
  product_id: string
  qty_received: number
  qty_invoiced: number
  unit_price: number
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  qty_po: number | null
  unit_price_po: number | null
  variance_qty: number
  variance_price: number
  match_status: 'MATCH' | 'OVER' | 'UNDER'
  sort_order: number
  product_code: string
  product_name: string
}

/** QC / barang masuk audit per invoice line (linked via gr_line_id) */
export interface PurchaseInvoiceGpLineAudit {
  purchase_invoice_line_id: string
  gr_line_id: string
  gp_input_id: string
  goods_processing_id: string
  processing_number: string
  processing_type: 'PASS_THROUGH' | 'DISASSEMBLY'
  gp_header_status: string
  product_code: string
  product_name: string
  requires_processing: boolean
  gp_line_status: 'PENDING' | 'PROCESSING' | 'QC_REVIEW' | 'CONFIRMED' | 'REJECTED'
  qty_input: number
  uom: string
  processed_at: string | null
  processed_by_name: string | null
  qc_confirmed_at: string | null
  qc_confirmed_by_name: string | null
  rejected_at: string | null
  rejected_by_name: string | null
  rejection_reason: string | null
  outputs: Array<{
    product_name: string
    qty_output: number
    uom: string
    is_waste: boolean
  }>
}

export interface PurchaseInvoiceDetail extends PurchaseInvoiceWithRelations {
  gr_links: PurchaseInvoiceGrLink[]
  lines: PurchaseInvoiceLine[]
  gp_line_audits: PurchaseInvoiceGpLineAudit[]
}

export interface CreatePurchaseInvoiceLineDto {
  gr_line_id: string
  qty_invoiced: number
  unit_price: number
  tax_rate: number
  sort_order: number
}

export interface CreatePurchaseInvoiceDto {
  supplier_id: string
  branch_id: string
  invoice_number: string
  invoice_date: string
  notes: string | null
  lines: CreatePurchaseInvoiceLineDto[]
}

export interface UpdatePurchaseInvoiceDto {
  notes?: string | null
  lines: CreatePurchaseInvoiceLineDto[]
}

