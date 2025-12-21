import { supabase } from '../../config/supabase'
import { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto } from '../../types/product.types'

export class ProductsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    includeDeleted = false
  ): Promise<{ data: Product[]; total: number }> {
    let query = supabase.from('products').select('*')
    let countQuery = supabase.from('products').select('*', { count: 'exact', head: true })

    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
      countQuery = countQuery.eq('is_deleted', false)
    }

    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.category_id) {
        query = query.eq('category_id', filter.category_id)
        countQuery = countQuery.eq('category_id', filter.category_id)
      }
      if (filter.sub_category_id) {
        query = query.eq('sub_category_id', filter.sub_category_id)
        countQuery = countQuery.eq('sub_category_id', filter.sub_category_id)
      }
    }

    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('product_name', { ascending: true })
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
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    includeDeleted = false
  ): Promise<{ data: Product[]; total: number }> {
    let query = supabase.from('products').select('*')
    let countQuery = supabase.from('products').select('*', { count: 'exact', head: true })

    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
      countQuery = countQuery.eq('is_deleted', false)
    }

    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm}%`
      query = query.or(`product_name.ilike.${pattern},product_code.ilike.${pattern}`)
      countQuery = countQuery.or(`product_name.ilike.${pattern},product_code.ilike.${pattern}`)
    }

    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.category_id) {
        query = query.eq('category_id', filter.category_id)
        countQuery = countQuery.eq('category_id', filter.category_id)
      }
      if (filter.sub_category_id) {
        query = query.eq('sub_category_id', filter.sub_category_id)
        countQuery = countQuery.eq('sub_category_id', filter.sub_category_id)
      }
    }

    if (sort) {
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

  async getById(id: string, includeDeleted = false): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    if (data.is_deleted && !includeDeleted) return null
    return data
  }

  async findByProductCode(code: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', code)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async create(data: CreateProductDto & { created_by?: string; updated_by?: string }): Promise<Product> {
    const { data: product, error } = await supabase
      .from('products')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return product
  }

  async updateById(id: string, updates: UpdateProductDto & { updated_by?: string }): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('products').update({ is_deleted: true }).eq('id', id)

    if (error) throw new Error(error.message)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase.from('products').update({ is_deleted: true }).in('id', ids)

    if (error) throw new Error(error.message)
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    const { error } = await supabase.from('products').update({ status }).in('id', ids)

    if (error) throw new Error(error.message)
  }

  async getFilterOptions(): Promise<{ statuses: string[] }> {
    const statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED']
    return { statuses }
  }

  async minimalActive(): Promise<{ id: string; product_name: string }[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_name')
      .eq('status', 'ACTIVE')
      .eq('is_deleted', false)
      .order('product_name')
      .limit(1000)

    if (error) throw new Error(error.message)
    return data || []
  }
}

export const productsRepository = new ProductsRepository()
