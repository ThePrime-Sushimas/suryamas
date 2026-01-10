// Supplier Product Types - Comprehensive TypeScript definitions

export type SupplierProductStatus = 'ACTIVE' | 'INACTIVE'

export type ProductType = 'raw' | 'semi_finished' | 'finished_goods'

export type Currency = 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR'

export interface SupplierProduct {
  id: string
  supplier_id: string
  product_id: string
  price: number
  currency: Currency
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

export interface SupplierInfo {
  id: string
  supplier_name: string
  supplier_code: string
  is_active: boolean
}

export interface ProductInfo {
  id: string
  product_name: string
  product_code: string
  product_type: ProductType
  status: SupplierProductStatus
  default_purchase_unit?: string | null
}

export interface SupplierProductWithRelations extends SupplierProduct {
  supplier?: SupplierInfo
  product?: ProductInfo
}

export interface CreateSupplierProductDto {
  supplier_id: string
  product_id: string
  price: number
  currency?: Currency
  lead_time_days?: number | null
  min_order_qty?: number | null
  is_preferred?: boolean
  is_active?: boolean
}

export type UpdateSupplierProductDto = Partial<Omit<CreateSupplierProductDto, 'supplier_id' | 'product_id'>>

export interface SupplierProductListQuery {
  page?: number
  limit?: number
  search?: string
  supplier_id?: string
  product_id?: string
  is_preferred?: boolean
  is_active?: boolean
  include_deleted?: boolean
  sort_by?: 'price' | 'lead_time_days' | 'min_order_qty' | 'created_at' | 'updated_at'
  sort_order?: 'asc' | 'desc'
}

export interface SupplierProductOption {
  id: string
  supplier_name: string
  product_name: string
  price: number
  currency: string
}

export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SupplierProductFormData extends CreateSupplierProductDto {
  supplier_name?: string
  product_name?: string
}

