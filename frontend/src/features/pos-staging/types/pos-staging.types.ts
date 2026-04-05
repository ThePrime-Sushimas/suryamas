export type StagingTable =
  | 'branches'
  | 'payment_methods'
  | 'menu_categories'
  | 'menu_groups'
  | 'menus'

export type StagingStatus = 'pending' | 'approved' | 'ignored'

export interface StagingBranch {
  pos_id: number
  branch_name: string
  branch_code?: string | null
  address?: string | null
  phone?: string | null
  flag_active: number
  mapped_id?: string | null
  status: StagingStatus
  pos_synced_at?: string | null
  created_at: string
  updated_at: string
}

export interface StagingPaymentMethod {
  pos_id: number
  pos_branch_id?: number | null
  name: string
  code?: string | null
  coa_no?: string | null
  flag_active: number
  mapped_id?: number | null
  status: StagingStatus
  pos_synced_at?: string | null
  created_at: string
  updated_at: string
}

export interface StagingMenuCategory {
  pos_id: number
  category_name: string
  sales_coa_no?: string | null
  flag_active: number
  status: StagingStatus
  pos_synced_at?: string | null
  created_at: string
  updated_at: string
}

export interface StagingMenuGroup {
  pos_id: number
  pos_category_id?: number | null
  group_name: string
  group_code?: string | null
  flag_active: number
  status: StagingStatus
  pos_synced_at?: string | null
  created_at: string
  updated_at: string
}

export interface StagingMenu {
  pos_id: number
  pos_group_id?: number | null
  menu_name: string
  menu_short_name?: string | null
  menu_code?: string | null
  price?: number | null
  estimated_cost?: number | null
  flag_tax?: number | null
  flag_other_tax?: number | null
  sales_coa_no?: string | null
  cogs_coa_no?: string | null
  flag_active: number
  mapped_product_id?: string | null
  status: StagingStatus
  pos_synced_at?: string | null
  created_at: string
  updated_at: string
}

export type StagingRow =
  | StagingBranch
  | StagingPaymentMethod
  | StagingMenuCategory
  | StagingMenuGroup
  | StagingMenu

export interface StagingListParams {
  status?: StagingStatus
  page?: number
  limit?: number
}

export interface StagingUpdatePayload {
  status: StagingStatus
  mapped_id?: string | number | null
  mapped_product_id?: string | null
}

export interface StagingListResponse {
  success: boolean
  data: StagingRow[]
  total: number
  page: number
  limit: number
}
