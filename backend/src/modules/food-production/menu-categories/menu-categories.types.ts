export interface MenuCategory {
  id: string
  company_id: string
  category_name: string
  category_code: string
  sales_coa_id: string | null
  cogs_coa_id: string | null
  sort_order: number
  is_active: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface MenuCategoryWithCoa extends MenuCategory {
  sales_coa_code?: string | null
  sales_coa_name?: string | null
  cogs_coa_code?: string | null
  cogs_coa_name?: string | null
}

export interface CreateMenuCategoryDto {
  category_code: string
  category_name: string
  sales_coa_id?: string | null
  cogs_coa_id?: string | null
  sort_order?: number
  is_active?: boolean
  created_by?: string
  updated_by?: string
}

export interface UpdateMenuCategoryDto {
  category_name?: string
  sales_coa_id?: string | null
  cogs_coa_id?: string | null
  sort_order?: number
  is_active?: boolean
  updated_by?: string
}
