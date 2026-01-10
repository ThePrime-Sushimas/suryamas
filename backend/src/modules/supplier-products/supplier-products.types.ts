export interface SupplierProduct {
  id: string
  supplier_id: string
  product_id: string
  price: number
  currency: string
  lead_time_days: number | null
  min_order_qty: number | null
  is_preferred: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
}

export interface SupplierProductWithRelations extends SupplierProduct {
  supplier?: {
    id: string
    supplier_name: string
    supplier_code: string
    is_active: boolean
  }
  product?: {
    id: string
    product_name: string
    product_code: string
    product_type: string
    status: string
    default_purchase_unit?: string | null
  }
}

export interface CreateSupplierProductDto {
  supplier_id: string
  product_id: string
  price: number
  currency?: string
  lead_time_days?: number
  min_order_qty?: number
  is_preferred?: boolean
  is_active?: boolean
}

export interface UpdateSupplierProductDto {
  price?: number
  currency?: string
  lead_time_days?: number
  min_order_qty?: number
  is_preferred?: boolean
  is_active?: boolean
}

export interface SupplierProductListQuery {
  page?: number
  limit?: number
  search?: string
  supplier_id?: string
  product_id?: string
  is_preferred?: boolean
  is_active?: boolean
  include_deleted?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface SupplierProductOption {
  id: string
  supplier_name: string
  product_name: string
  price: number
  currency: string
}