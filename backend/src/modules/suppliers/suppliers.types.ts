export type SupplierType = 'vegetables' | 'meat' | 'seafood' | 'dairy' | 'beverage' | 'dry_goods' | 'packaging' | 'other' | 'frozen_food'

export type InvoiceBypassReason = 'marketplace' | 'cash' | 'informal'

export interface Supplier {
  id: string
  supplier_code: string
  supplier_name: string
  supplier_type: SupplierType
  contact_person: string
  phone: string
  email: string | null
  address: string
  city: string
  province: string
  postal_code: string | null
  tax_id: string | null
  business_license: string | null
  payment_term_id: number | null
  payment_term_days: number | null
  payment_term_name: string | null
  lead_time_days: number
  minimum_order: number
  rating: number | null
  is_active: boolean
  notes: string | null
  requires_invoice: boolean
  default_tax_rate: number
  invoice_bypass_reason: InvoiceBypassReason | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateSupplierDto {
  supplier_code: string
  supplier_name: string
  supplier_type: SupplierType
  contact_person: string
  phone: string
  email?: string
  address?: string
  city?: string
  province?: string
  postal_code?: string
  tax_id?: string
  business_license?: string
  payment_term_id?: number
  lead_time_days?: number
  minimum_order?: number
  rating?: number
  is_active?: boolean
  notes?: string
  requires_invoice?: boolean
  default_tax_rate?: number
  invoice_bypass_reason?: InvoiceBypassReason
}

export interface UpdateSupplierDto {
  supplier_code?: string
  supplier_name?: string
  supplier_type?: SupplierType
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  province?: string
  postal_code?: string
  tax_id?: string
  business_license?: string
  payment_term_id?: number
  lead_time_days?: number
  minimum_order?: number
  rating?: number
  is_active?: boolean
  notes?: string
  requires_invoice?: boolean
  default_tax_rate?: number
  invoice_bypass_reason?: InvoiceBypassReason | null
}

export interface SupplierListQuery {
  page?: number
  limit?: number
  search?: string
  supplier_type?: SupplierType
  is_active?: boolean
  include_deleted?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface SupplierOption {
  id: string
  supplier_name: string
}