import { supabase } from '../../config/supabase'
import { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, SupplierOption } from './suppliers.types'
import { mapSupplierResponse, mapSupplierOption } from './suppliers.mapper'

export class SuppliersRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: SupplierListQuery
  ): Promise<{ data: Supplier[]; total: number }> {
    let dbQuery = supabase.from('suppliers').select('*')
    let countQuery = supabase.from('suppliers').select('*', { count: 'exact', head: true })

    // Filter deleted
    if (!query?.include_deleted) {
      dbQuery = dbQuery.is('deleted_at', null)
      countQuery = countQuery.is('deleted_at', null)
    }

    // Search filter
    if (query?.search) {
      const searchTerm = `%${query.search}%`
      dbQuery = dbQuery.or(`supplier_code.ilike.${searchTerm},supplier_name.ilike.${searchTerm}`)
      countQuery = countQuery.or(`supplier_code.ilike.${searchTerm},supplier_name.ilike.${searchTerm}`)
    }

    // Type filter
    if (query?.supplier_type) {
      dbQuery = dbQuery.eq('supplier_type', query.supplier_type)
      countQuery = countQuery.eq('supplier_type', query.supplier_type)
    }

    // Active filter
    if (query?.is_active !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.is_active)
      countQuery = countQuery.eq('is_active', query.is_active)
    }

    // Sorting
    const sortBy = query?.sort_by || 'supplier_name'
    const sortOrder = query?.sort_order || 'asc'
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' })

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      dbQuery.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: (data || []).map(mapSupplierResponse), total: count || 0 }
  }

  async findById(id: string, includeDeleted = false): Promise<Supplier | null> {
    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapSupplierResponse(data) : null
  }

  async findByCode(code: string, excludeId?: string): Promise<Supplier | null> {
    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('supplier_code', code)
      .is('deleted_at', null)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapSupplierResponse(data) : null
  }

  async create(data: CreateSupplierDto & { created_by?: string }): Promise<Supplier> {
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        ...data,
        lead_time_days: data.lead_time_days ?? 1,
        minimum_order: data.minimum_order ?? 0,
        is_active: data.is_active ?? true,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapSupplierResponse(supplier)
  }

  async updateById(id: string, updates: UpdateSupplierDto & { updated_by?: string }): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapSupplierResponse(data) : null
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('suppliers')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new Error(error.message)
  }

  async restore(id: string, userId?: string): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        deleted_at: null,
        is_active: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapSupplierResponse(data) : null
  }

  async getActiveOptions(): Promise<SupplierOption[]> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, supplier_name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('supplier_name')

    if (error) throw new Error(error.message)
    return (data || []).map(mapSupplierOption)
  }
}

export const suppliersRepository = new SuppliersRepository()