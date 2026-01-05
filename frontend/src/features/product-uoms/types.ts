export type UomStatus = 'ACTIVE' | 'INACTIVE'

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

export interface CreateProductUomDto {
  metric_unit_id?: string
  unit_name: string
  conversion_factor: number
  is_base_unit?: boolean
  base_price?: number
  is_default_stock_unit?: boolean
  is_default_purchase_unit?: boolean
  is_default_base_unit?: boolean
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
  is_default_base_unit?: boolean
  is_default_transfer_unit?: boolean
  status_uom?: UomStatus
}
