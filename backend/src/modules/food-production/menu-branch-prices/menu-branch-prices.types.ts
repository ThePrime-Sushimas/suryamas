export interface MenuBranchPrice {
  id: string
  company_id: string
  menu_id: string
  branch_id: string
  selling_price: number
  price_type: 'DINE_IN' | 'DELIVERY' | 'TAKEAWAY'
  source: 'MANUAL' | 'POS_SYNC' | 'IMPORT'
  synced_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface MenuBranchPriceWithBranch extends MenuBranchPrice {
  branch_name: string
  branch_is_active: boolean
}

export interface CreateMenuBranchPriceDto {
  menu_id: string
  branch_id: string
  selling_price: number
  price_type?: 'DINE_IN' | 'DELIVERY' | 'TAKEAWAY'
  source?: 'MANUAL' | 'POS_SYNC' | 'IMPORT'
  created_by?: string
  updated_by?: string
}

export interface UpdateMenuBranchPriceDto {
  selling_price: number
  updated_by?: string
}

export interface SyncFromPosResult {
  inserted: number
  synced: number
  skipped_manual: number
  skipped_threshold: number
}
