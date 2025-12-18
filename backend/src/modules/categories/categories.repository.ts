import { supabase } from '../../config/supabase'
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../../types/category.types'

const ALLOWED_SORT_FIELDS = ['id', 'category_code', 'category_name', 'sort_order', 'created_at', 'updated_at']

export class CategoriesRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ data: Category[]; total: number }> {
    let query = supabase.from('categories').select('*').eq('is_deleted', false)
    let countQuery = supabase.from('categories').select('*', { count: 'exact', head: true }).eq('is_deleted', false)

    if (sort && ALLOWED_SORT_FIELDS.includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('sort_order', { ascending: true }).order('category_name', { ascending: true })
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
  ): Promise<{ data: Category[]; total: number }> {
    let query = supabase.from('categories').select('*').eq('is_deleted', true)
    let countQuery = supabase.from('categories').select('*', { count: 'exact', head: true }).eq('is_deleted', true)

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
  ): Promise<{ data: Category[]; total: number }> {
    let query = supabase.from('categories').select('*').eq('is_deleted', false)
    let countQuery = supabase.from('categories').select('*', { count: 'exact', head: true }).eq('is_deleted', false)

    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm}%`
      query = query.or(`category_name.ilike.${pattern},category_code.ilike.${pattern}`)
      countQuery = countQuery.or(`category_name.ilike.${pattern},category_code.ilike.${pattern}`)
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

  async findById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByCode(code: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('category_code', code)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async create(data: CreateCategoryDto & { created_by?: string; updated_by?: string }): Promise<Category> {
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        ...data,
        sort_order: data.sort_order ?? 0,
        is_deleted: false,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return category
  }

  async updateById(
    id: string,
    updates: UpdateCategoryDto & { updated_by?: string }
  ): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
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
      .from('categories')
      .update({ is_deleted: true, updated_by: userId })
      .eq('id', id)
      .eq('is_deleted', false)

    if (error) throw new Error(error.message)
  }

  async restore(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .update({ is_deleted: false, updated_by: userId })
      .eq('id', id)
      .eq('is_deleted', true)

    if (error) throw new Error(error.message)
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .update({ is_deleted: true, updated_by: userId })
      .in('id', ids)
      .eq('is_deleted', false)

    if (error) throw new Error(error.message)
  }

  async exportData(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_deleted', false)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  }
}

export const categoriesRepository = new CategoriesRepository()
