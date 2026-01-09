export type SupplierType = 'vegetables' | 'meat' | 'seafood' | 'dairy' | 'beverage' | 'dry_goods' | 'packaging' | 'other'

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
  payment_term_name?: string
  lead_time_days: number
  minimum_order: number
  rating: number | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateSupplierDto {
  supplier_code: string
  supplier_name: string
  supplier_type: SupplierType
  contact_person: string
  phone: string
  email?: string
  address: string
  city: string
  province: string
  postal_code?: string
  tax_id?: string
  business_license?: string
  payment_term_id?: number
  lead_time_days?: number
  minimum_order?: number
  rating?: number
  is_active?: boolean
  notes?: string
}

export type UpdateSupplierDto = Omit<Partial<CreateSupplierDto>, 'supplier_code'>

export interface SupplierListQuery {
  page?: number
  limit?: number
  search?: string
  supplier_type?: SupplierType
  is_active?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface SupplierOption {
  id: string
  supplier_name: string
}

export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}