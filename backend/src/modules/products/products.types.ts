export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'
export type ProductType = 'raw' | 'semi_finished' | 'finished_goods'
export type UomStatus = 'ACTIVE' | 'INACTIVE'

export interface Product {
  id: string
  product_code: string
  product_name: string
  bom_name: string | null
  category_id: string
  sub_category_id: string
  product_type: ProductType
  average_cost: number
  is_requestable: boolean
  is_purchasable: boolean
  notes: string | null
  status: ProductStatus
  is_deleted: boolean
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
  is_default_transfer_unit: boolean
  status_uom: UomStatus
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface CreateProductDto {
  product_code?: string
  product_name: string
  bom_name?: string
  category_id: string
  sub_category_id: string
  product_type?: ProductType
  average_cost?: number
  is_requestable?: boolean
  is_purchasable?: boolean
  notes?: string
  status?: ProductStatus
}

export interface UpdateProductDto {
  product_name?: string
  bom_name?: string
  category_id?: string
  sub_category_id?: string
  product_type?: ProductType
  average_cost?: number
  is_requestable?: boolean
  is_purchasable?: boolean
  notes?: string
  status?: ProductStatus
}

export interface CreateProductUomDto {
  metric_unit_id: string
  conversion_factor: number
  is_base_unit?: boolean
  base_price?: number
  is_default_stock_unit?: boolean
  is_default_purchase_unit?: boolean
  is_default_transfer_unit?: boolean
  status_uom?: UomStatus
}

export interface UpdateProductUomDto {
  metric_unit_id?: string
  conversion_factor?: number
  is_base_unit?: boolean
  base_price?: number
  is_default_stock_unit?: boolean
  is_default_purchase_unit?: boolean
  is_default_transfer_unit?: boolean
  status_uom?: UomStatus
}
