import { supabase } from '../../config/supabase'
import { Product, CreateProductDto, UpdateProductDto, ProductStatus } from './products.types'
import { mapProductFromDb, mapProductWithRelations } from './products.mapper'
import { PRODUCT_SORT_FIELDS, PRODUCT_LIMITS } from './products.constants'

export class ProductsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    includeDeleted = false
  ): Promise<{ data: Product[]; total: number }> {
    let query = supabase.from('products').select(`
      id, product_code, product_name, category_id, sub_category_id, product_type, average_cost, status, is_deleted, is_requestable, is_purchasable, created_at,
      categories(category_name),
      sub_categories(sub_category_name)
    `)
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
      if (filter.product_type) {
        query = query.eq('product_type', filter.product_type)
        countQuery = countQuery.eq('product_type', filter.product_type)
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

    if (sort && PRODUCT_SORT_FIELDS.includes(sort.field as any)) {
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

    const rows = (data || []).map(mapProductWithRelations)

    return { data: rows, total: count || 0 }
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
      if (filter.product_type) {
        query = query.eq('product_type', filter.product_type)
        countQuery = countQuery.eq('product_type', filter.product_type)
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

    if (sort && PRODUCT_SORT_FIELDS.includes(sort.field as any)) {
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

    return { data: (data || []).map(mapProductFromDb), total: count || 0 }
  }

  async findById(id: string, includeDeleted = false): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    if (data.is_deleted && !includeDeleted) return null
    return mapProductFromDb(data)
  }

  async findByProductCode(code: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', code)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return mapProductFromDb(data)
  }

  async findByProductName(name: string, excludeId?: string): Promise<Product | null> {
    let query = supabase
      .from('products')
      .select('*')
      .ilike('product_name', name)
      .eq('is_deleted', false)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return mapProductFromDb(data)
  }

  async create(data: CreateProductDto & { created_by?: string; updated_by?: string }): Promise<Product> {
    const { data: product, error } = await supabase
      .from('products')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapProductFromDb(product)
  }

  async updateById(id: string, updates: UpdateProductDto & { updated_by?: string; is_deleted?: boolean }): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapProductFromDb(data) : null
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('products').update({ is_deleted: true }).eq('id', id)

    if (error) throw new Error(error.message)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid ids array')
    }
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new Error(`Bulk operation exceeds maximum limit of ${PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE}`)
    }
    const { error } = await supabase.from('products').update({ is_deleted: true }).in('id', ids)

    if (error) throw new Error(error.message)
  }

  async bulkUpdateStatus(ids: string[], status: ProductStatus): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid ids array')
    }
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new Error(`Bulk operation exceeds maximum limit of ${PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE}`)
    }
    const { error } = await supabase.from('products').update({ status }).in('id', ids)

    if (error) throw new Error(error.message)
  }

  async bulkRestore(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid ids array')
    }
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new Error(`Bulk operation exceeds maximum limit of ${PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE}`)
    }
    const { error } = await supabase.from('products').update({ is_deleted: false }).in('id', ids)

    if (error) throw new Error(error.message)
  }

  async getFilterOptions(): Promise<{ statuses: string[]; productTypes: string[] }> {
    const statuses = ['ACTIVE', 'INACTIVE', 'DISCONTINUED']
    const productTypes = ['raw', 'semi_finished', 'finished_goods']
    return { statuses, productTypes }
  }

  async minimalActive(): Promise<{ id: string; product_name: string }[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_name')
      .eq('status', 'ACTIVE')
      .eq('is_deleted', false)
      .order('product_name')
      .limit(PRODUCT_LIMITS.MAX_MINIMAL_PRODUCTS)

    if (error) throw new Error(error.message)
    return data || []
  }
}

export const productsRepository = new ProductsRepository()
