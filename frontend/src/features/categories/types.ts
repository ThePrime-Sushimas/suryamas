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

export type CreateCategoryDto = Pick<Category, 'category_code' | 'category_name'> & Partial<Pick<Category, 'description' | 'sort_order'>>
export type UpdateCategoryDto = Partial<Omit<Category, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'is_deleted'>>

export type CreateSubCategoryDto = Pick<SubCategory, 'category_id' | 'sub_category_code' | 'sub_category_name'> & Partial<Pick<SubCategory, 'description' | 'sort_order'>>
export type UpdateSubCategoryDto = Partial<Omit<SubCategory, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'is_deleted'>>
