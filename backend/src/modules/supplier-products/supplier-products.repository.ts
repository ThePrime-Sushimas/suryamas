import { supabase } from '../../config/supabase'
import { 
  SupplierProduct, 
  SupplierProductWithRelations, 
  CreateSupplierProductDto, 
  UpdateSupplierProductDto, 
  SupplierProductListQuery,
  SupplierProductOption
} from './supplier-products.types'
import { 
  mapSupplierProductFromDb, 
  mapSupplierProductWithRelations,
  mapSupplierProductOption
} from './supplier-products.mapper'
import { SUPPLIER_PRODUCT_SORT_FIELDS } from './supplier-products.constants'

export class SupplierProductsRepository {
  /**
   * Find all supplier products with pagination and filtering
   */
  async findAll(
    pagination: { limit: number; offset: number },
    query?: SupplierProductListQuery,
    includeRelations = false
  ): Promise<{ data: SupplierProduct[] | SupplierProductWithRelations[]; total: number }> {
    const selectFields = includeRelations 
      ? `*, suppliers(id, supplier_name, supplier_code, is_active), products(id, product_name, product_code, product_type, status, default_purchase_unit)`
      : '*'

    let dbQuery = supabase.from('supplier_products').select(selectFields)
    let countQuery = supabase.from('supplier_products').select('*', { count: 'exact', head: true })

    // Exclude soft deleted (unless include_deleted is true)
    if (!query?.include_deleted) {
      dbQuery = dbQuery.is('deleted_at', null)
      countQuery = countQuery.is('deleted_at', null)
    }

    // Apply filters
    if (query?.supplier_id) {
      dbQuery = dbQuery.eq('supplier_id', query.supplier_id)
      countQuery = countQuery.eq('supplier_id', query.supplier_id)
    }

    if (query?.product_id) {
      dbQuery = dbQuery.eq('product_id', query.product_id)
      countQuery = countQuery.eq('product_id', query.product_id)
    }

    if (query?.is_preferred !== undefined) {
      dbQuery = dbQuery.eq('is_preferred', query.is_preferred)
      countQuery = countQuery.eq('is_preferred', query.is_preferred)
    }

    if (query?.is_active !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.is_active)
      countQuery = countQuery.eq('is_active', query.is_active)
    }

    // Sorting
    const sortBy = query?.sort_by && SUPPLIER_PRODUCT_SORT_FIELDS.includes(query.sort_by as string) 
      ? query.sort_by 
      : 'created_at'
    const sortOrder = query?.sort_order || 'desc'
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' })

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      dbQuery.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(`Database query failed: ${error.message}`)
    if (countError) throw new Error(`Count query failed: ${countError.message}`)

    const mappedData = includeRelations
      ? (data || []).map(mapSupplierProductWithRelations)
      : (data || []).map(mapSupplierProductFromDb)

    return { data: mappedData, total: count || 0 }
  }

  /**
   * Find supplier product by ID
   */
  async findById(id: string, includeRelations = false, includeDeleted = false): Promise<SupplierProduct | SupplierProductWithRelations | null> {
    const selectFields = includeRelations 
      ? `*, suppliers(id, supplier_name, supplier_code, is_active), products(id, product_name, product_code, product_type, status, default_purchase_unit)`
      : '*'

    let query = supabase
      .from('supplier_products')
      .select(selectFields)
      .eq('id', id)

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(`Database query failed: ${error.message}`)
    if (!data) return null

    return includeRelations 
      ? mapSupplierProductWithRelations(data)
      : mapSupplierProductFromDb(data)
  }

  /**
   * Find supplier products by supplier ID
   */
  async findBySupplier(supplierId: string, includeRelations = false): Promise<SupplierProduct[] | SupplierProductWithRelations[]> {
    const selectFields = includeRelations 
      ? `*, products(id, product_name, product_code, product_type, status, default_purchase_unit)`
      : '*'

    const { data, error } = await supabase
      .from('supplier_products')
      .select(selectFields)
      .eq('supplier_id', supplierId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('is_preferred', { ascending: false })
      .order('price', { ascending: true })

    if (error) throw new Error(`Database query failed: ${error.message}`)

    return includeRelations
      ? (data || []).map(mapSupplierProductWithRelations)
      : (data || []).map(mapSupplierProductFromDb)
  }

  /**
   * Find supplier products by product ID
   */
  async findByProduct(productId: string, includeRelations = false): Promise<SupplierProduct[] | SupplierProductWithRelations[]> {
    const selectFields = includeRelations 
      ? `*, suppliers(id, supplier_name, supplier_code, is_active)`
      : '*'

    const { data, error } = await supabase
      .from('supplier_products')
      .select(selectFields)
      .eq('product_id', productId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('is_preferred', { ascending: false })
      .order('price', { ascending: true })

    if (error) throw new Error(`Database query failed: ${error.message}`)

    return includeRelations
      ? (data || []).map(mapSupplierProductWithRelations)
      : (data || []).map(mapSupplierProductFromDb)
  }

  /**
   * Check if supplier-product combination exists
   */
  async findBySupplierAndProduct(supplierId: string, productId: string, excludeId?: string): Promise<SupplierProduct | null> {
    let query = supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('product_id', productId)
      .is('deleted_at', null)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(`Database query failed: ${error.message}`)
    return data ? mapSupplierProductFromDb(data) : null
  }

  /**
   * Count preferred suppliers for a product
   */
  async countPreferredByProduct(productId: string, excludeId?: string): Promise<number> {
    let query = supabase
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('is_preferred', true)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { count, error } = await query

    if (error) throw new Error(`Database query failed: ${error.message}`)
    return count || 0
  }

  /**
   * Create new supplier product
   */
  async create(data: CreateSupplierProductDto & { created_by?: string; updated_by?: string }): Promise<SupplierProduct> {
    const { data: supplierProduct, error } = await supabase
      .from('supplier_products')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(`Database insert failed: ${error.message}`)
    return mapSupplierProductFromDb(supplierProduct)
  }

  /**
   * Update supplier product by ID
   */
  async updateById(id: string, updates: UpdateSupplierProductDto & { updated_by?: string }): Promise<SupplierProduct | null> {
    const { data, error } = await supabase
      .from('supplier_products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(`Database update failed: ${error.message}`)
    return data ? mapSupplierProductFromDb(data) : null
  }

  /**
   * Delete supplier product (soft delete)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('supplier_products')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new Error(`Database delete failed: ${error.message}`)
  }

  /**
   * Bulk delete supplier products (soft delete)
   */
  async bulkDelete(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid ids array')
    }

    const { error } = await supabase
      .from('supplier_products')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .in('id', ids)
      .is('deleted_at', null)

    if (error) throw new Error(`Database bulk delete failed: ${error.message}`)
  }

  /**
   * Restore soft-deleted supplier product
   */
  async restore(id: string): Promise<SupplierProduct | null> {
    const { data, error } = await supabase
      .from('supplier_products')
      .update({
        deleted_at: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select()
      .maybeSingle()

    if (error) throw new Error(`Database restore failed: ${error.message}`)
    return data ? mapSupplierProductFromDb(data) : null
  }

  /**
   * Bulk restore supplier products
   */
  async bulkRestore(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid ids array')
    }

    const { error } = await supabase
      .from('supplier_products')
      .update({
        deleted_at: null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .not('deleted_at', 'is', null)

    if (error) throw new Error(`Database bulk restore failed: ${error.message}`)
  }

  /**
   * Get active supplier products for dropdown/options
   */
  async getActiveOptions(): Promise<SupplierProductOption[]> {
    const { data, error } = await supabase
      .from('supplier_products')
      .select(`
        id,
        price,
        currency,
        suppliers(supplier_name),
        products(product_name)
      `)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('suppliers(supplier_name)')
      .order('products(product_name)')

    if (error) throw new Error(`Database query failed: ${error.message}`)
    return (data || []).map(mapSupplierProductOption)
  }
}

export const supplierProductsRepository = new SupplierProductsRepository()