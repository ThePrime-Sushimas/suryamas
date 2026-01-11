export type PricelistStatus = 'DRAFT' | 'APPROVED' | 'EXPIRED' | 'REJECTED'

export interface Pricelist {
  id: string
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  price: number
  currency: string
  valid_from: string
  valid_to: string | null
  status: PricelistStatus
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
}

export interface PricelistWithRelations extends Pricelist {
  supplier_name?: string
  product_name?: string
  uom_name?: string
}

export interface CreatePricelistDto {
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  price: number
  currency?: string
  valid_from: string
  valid_to?: string | null
  is_active?: boolean
}

export interface UpdatePricelistDto {
  price?: number
  currency?: string
  valid_from?: string
  valid_to?: string | null
  is_active?: boolean
}

export interface PricelistListQuery {
  page?: number
  limit?: number
  supplier_id?: string
  product_id?: string
  status?: PricelistStatus
  is_active?: boolean
  include_deleted?: boolean
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PricelistApprovalDto {
  status: 'APPROVED' | 'REJECTED'
}

export interface PricelistLookup {
  supplier_id: string
  product_id: string
  uom_id: string
  date?: string
}
