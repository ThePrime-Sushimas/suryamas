export interface Category {
  id: string
  category_code: string
  category_name: string
  description: string | null
  sort_order: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface SubCategory {
  id: string
  category_id: string
  sub_category_code: string
  sub_category_name: string
  description: string | null
  sort_order: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface SubCategoryWithCategory extends SubCategory {
  category?: {
    id: string
    category_code: string
    category_name: string
  }
}
