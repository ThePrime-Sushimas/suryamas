export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'
export type UomStatus = 'ACTIVE' | 'INACTIVE'

export interface Product {
  id: string
  product_code: string
  product_name: string
  bom_name: string | null
  category_id: string
  sub_category_id: string
  category_name: string | null
  sub_category_name: string | null
  average_cost: number
  base_unit_name: string | null
  station: string | null
  station_name: string | null
  is_requestable: boolean
  is_purchasable: boolean
  is_asset: boolean
  requires_processing: boolean
  notes: string | null
  status: ProductStatus
  is_deleted: boolean
  default_purchase_unit?: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface ProductUom {
  id: string
  product_id: string
  metric_unit_id: string | null
  unit_name: string
  conversion_factor: number
  is_base_unit: boolean
  base_price: number | null
  is_default_stock_unit: boolean
  is_default_purchase_unit: boolean
  is_default_base_unit: boolean
  is_default_transfer_unit: boolean
  status_uom: UomStatus
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface CreateProductDto {
  product_code: string
  product_name: string
  bom_name?: string
  category_id: string
  sub_category_id: string
  station?: string | null
  average_cost?: number
  is_requestable?: boolean
  is_purchasable?: boolean
  is_asset?: boolean
  notes?: string
  status?: ProductStatus
  base_unit_id?: string
}

export interface UpdateProductDto {
  product_name?: string
  bom_name?: string
  category_id?: string
  sub_category_id?: string
  station?: string | null
  is_requestable?: boolean
  is_purchasable?: boolean
  is_asset?: boolean
  requires_processing?: boolean
  notes?: string
  status?: ProductStatus
}

export interface CreateProductUomDto {
  metric_unit_id?: string
  unit_name: string
  conversion_factor: number
  is_base_unit?: boolean
  base_price?: number
  is_default_stock_unit?: boolean
  is_default_purchase_unit?: boolean
  is_default_transfer_unit?: boolean
  status_uom?: UomStatus
}

export interface UpdateProductUomDto {
  unit_name?: string
  conversion_factor?: number
  is_base_unit?: boolean
  base_price?: number
  is_default_stock_unit?: boolean
  is_default_purchase_unit?: boolean
  is_default_transfer_unit?: boolean
  status_uom?: UomStatus
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
