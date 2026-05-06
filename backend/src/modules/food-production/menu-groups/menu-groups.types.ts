export interface MenuGroup {
  id: string
  company_id: string
  category_id: string
  group_name: string
  group_code: string
  sort_order: number
  is_active: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface MenuGroupWithCategory extends MenuGroup {
  category_name?: string
  category_code?: string
}

export interface CreateMenuGroupDto {
  category_id: string
  group_code: string
  group_name: string
  sort_order?: number
  is_active?: boolean
  created_by?: string
  updated_by?: string
}

export interface UpdateMenuGroupDto {
  category_id?: string
  group_name?: string
  sort_order?: number
  is_active?: boolean
  updated_by?: string
}
