export interface RecipeLine {
  id: string
  menu_id: string
  product_id: string | null
  wip_id: string | null
  qty: number
  uom: string
  cost_per_unit: number
  line_cost: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface RecipeLineWithDetails extends RecipeLine {
  ingredient_name: string
  ingredient_code: string
  ingredient_type: 'product' | 'wip'
}

export interface MenuRecipe {
  menu_id: string
  menu_name: string
  menu_code: string
  estimated_cost: number
  selling_price: number
  cost_percentage: number
  has_recipe: boolean
  lines: RecipeLineWithDetails[]
}

export interface SaveRecipeLineDto {
  product_id?: string | null
  wip_id?: string | null
  qty: number
  uom?: string
}
