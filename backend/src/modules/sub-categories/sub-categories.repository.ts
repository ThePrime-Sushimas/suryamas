import { supabase } from '../../config/supabase'
import { SubCategory, SubCategoryWithCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../../types/category.types'

const ALLOWED_SORT_FIELDS = ['id', 'category_id', 'sub_category_code', 'sub_category_name', 'sort_order', 'created_at', 'updated_at']

export class SubCategoriesRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    categoryId?: string
  ): Promise<{ data: SubCategoryWithCategory[]; total: number }> {
    let query = supabase.from('sub_categories').select('*, category:category_id (id, category_code, category_name)').eq('is_deleted', false)
    let countQuery = supabase.from('sub_categories').select('*', { count: 'exact', head: true }).eq('is_deleted', false)

    if (categoryId) {
      query = query.eq('category_id', categoryId)
      countQuery = countQuery.eq('category_id', categoryId)
    }

    if (sort && ALLOWED_SORT_FIELDS.includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('sort_order', { ascending: true }).order('sub_category_name', { ascending: true })
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: data || [], total: count || 0 }
  }

  async findTrash(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ data: SubCategoryWithCategory[]; total: number }> {
    let query = supabase.from('sub_categories').select('*, category:category_id (id, category_code, category_name)').eq('is_deleted', true)
    let countQuery = supabase.from('sub_categories').select('*', { count: 'exact', head: true }).eq('is_deleted', true)

    if (sort && ALLOWED_SORT_FIELDS.includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: data || [], total: count || 0 }
  }

  async search(
    searchTerm: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ data: SubCategoryWithCategory[]; total: number }> {
    let query = supabase.from('sub_categories').select('*, category:category_id (id, category_code, category_name)').eq('is_deleted', false)
    let countQuery = supabase.from('sub_categories').select('*', { count: 'exact', head: true }).eq('is_deleted', false)

    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm}%`
      query = query.or(`sub_category_name.ilike.${pattern},sub_category_code.ilike.${pattern}`)
      countQuery = countQuery.or(`sub_category_name.ilike.${pattern},sub_category_code.ilike.${pattern}`)
    }

    if (sort && ALLOWED_SORT_FIELDS.includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: data || [], total: count || 0 }
  }

  async findById(id: string): Promise<SubCategoryWithCategory | null> {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*, category:category_id (id, category_code, category_name)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByCode(code: string, categoryId: string): Promise<SubCategory | null> {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('sub_category_code', code)
      .eq('category_id', categoryId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByCategory(categoryId: string): Promise<SubCategory[]> {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  }

  async create(data: CreateSubCategoryDto & { created_by?: string; updated_by?: string }): Promise<SubCategory> {
    const { data: subCategory, error } = await supabase
      .from('sub_categories')
      .insert({
        ...data,
        sort_order: data.sort_order ?? 0,
        is_deleted: false,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return subCategory
  }

  async updateById(id: string, updates: UpdateSubCategoryDto & { updated_by?: string }): Promise<SubCategory | null> {
    const { data, error } = await supabase
      .from('sub_categories')
      .update(updates)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('sub_categories')
      .update({ is_deleted: true, updated_by: userId })
      .eq('id', id)
      .eq('is_deleted', false)

    if (error) throw new Error(error.message)
  }

  async restore(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('sub_categories')
      .update({ is_deleted: false, updated_by: userId })
      .eq('id', id)
      .eq('is_deleted', true)

    if (error) throw new Error(error.message)
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    const { error } = await supabase
      .from('sub_categories')
      .update({ is_deleted: true, updated_by: userId })
      .in('id', ids)
      .eq('is_deleted', false)

    if (error) throw new Error(error.message)
  }

  async exportData(): Promise<SubCategory[]> {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  }
}

export const subCategoriesRepository = new SubCategoriesRepository()
