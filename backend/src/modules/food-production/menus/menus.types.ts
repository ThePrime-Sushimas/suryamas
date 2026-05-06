export interface Menu {
  id: string
  company_id: string
  pos_menu_id: number | null
  category_id: string
  group_id: string | null
  menu_code: string
  menu_name: string
  selling_price: number
  estimated_cost: number
  cost_percentage: number
  has_recipe: boolean
  is_active: boolean
  is_deleted: boolean
  sync_enabled: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface MenuWithRelations extends Menu {
  category_name?: string
  category_code?: string
  group_name?: string | null
  group_code?: string | null
}

export interface CreateMenuDto {
  pos_menu_id?: number | null
  category_id: string
  group_id?: string | null
  menu_code: string
  menu_name: string
  selling_price?: number
  is_active?: boolean
  sync_enabled?: boolean
  created_by?: string
  updated_by?: string
}

export interface UpdateMenuDto {
  category_id?: string
  group_id?: string | null
  menu_name?: string
  selling_price?: number
  is_active?: boolean
  sync_enabled?: boolean
  updated_by?: string
}
