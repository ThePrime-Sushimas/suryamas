export type WarehouseType = 'MAIN' | 'READY' | 'CENTRAL_STOCK' | 'CENTRAL_KITCHEN'

export interface Warehouse {
  id: string
  company_id: string
  branch_id: string
  warehouse_code: string
  warehouse_name: string
  warehouse_type: WarehouseType
  is_active: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface WarehouseWithBranch extends Warehouse {
  branch_name: string
  branch_code: string
}

export interface CreateWarehouseDto {
  branch_id: string
  warehouse_code: string
  warehouse_name: string
  warehouse_type?: WarehouseType
  is_active?: boolean
  created_by?: string
  updated_by?: string
}

export interface UpdateWarehouseDto {
  warehouse_name?: string
  warehouse_type?: WarehouseType
  is_active?: boolean
  updated_by?: string
}
