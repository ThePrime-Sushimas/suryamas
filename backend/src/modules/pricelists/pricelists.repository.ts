import { supabase } from '../../config/supabase'
import { Pricelist, PricelistWithRelations, CreatePricelistDto, UpdatePricelistDto, PricelistListQuery, PricelistLookup } from './pricelists.types'

export class PricelistsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: PricelistListQuery
  ): Promise<{ data: PricelistWithRelations[]; total: number }> {
    let dbQuery = supabase
      .from('pricelists')
      .select(`
        *,
        suppliers!inner(supplier_name),
        products!inner(product_name),
        product_uoms(
          id,
          metric_units(unit_name)
        )
      `, { count: 'exact' })

    if (!query?.include_deleted) {
      dbQuery = dbQuery.is('deleted_at', null)
    }

    if (query?.supplier_id) {
      dbQuery = dbQuery.eq('supplier_id', query.supplier_id)
    }

    if (query?.product_id) {
      dbQuery = dbQuery.eq('product_id', query.product_id)
    }

    if (query?.status) {
      dbQuery = dbQuery.eq('status', query.status)
    }

    if (query?.is_active !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.is_active)
    }

    // Simple search on supplier name only
    if (query?.search) {
      dbQuery = dbQuery.ilike('suppliers.supplier_name', `%${query.search}%`)
    }

    const sortBy = query?.sort_by || 'created_at'
    const sortOrder = query?.sort_order || 'desc'
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data, error, count } = await dbQuery.range(
      pagination.offset,
      pagination.offset + pagination.limit - 1
    )

    if (error) throw new Error(error.message)
    
    const mapped = (data || []).map(item => {
      return {
        ...item,
        supplier_name: (item as any).suppliers?.supplier_name,
        product_name: (item as any).products?.product_name,
        uom_name: (item as any).product_uoms?.metric_units?.unit_name,
      }
    })

    // Check for duplicates
    const ids = mapped.map(item => item.id)
    const uniqueIds = new Set(ids)
    if (ids.length !== uniqueIds.size) {
      console.warn('Duplicate IDs in repository result:', ids.filter((id, index) => ids.indexOf(id) !== index))
    }

    return { data: mapped, total: count || 0 }
  }

  async findById(id: string): Promise<PricelistWithRelations | null> {
    const { data, error } = await supabase
      .from('pricelists')
      .select(`
        *,
        suppliers(supplier_name),
        products(product_name),
        product_uoms(
          id,
          metric_units(unit_name)
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    return {
      ...data,
      supplier_name: (data as any).suppliers?.supplier_name,
      product_name: (data as any).products?.product_name,
      uom_name: (data as any).product_uoms?.metric_units?.unit_name,
    }
  }

  async findActiveDuplicate(
    companyId: string,
    supplierId: string,
    productId: string,
    uomId: string
  ): Promise<Pricelist | null> {
    let query = supabase
      .from('pricelists')
      .select('*')
      .eq('company_id', companyId)
      .eq('supplier_id', supplierId)
      .eq('product_id', productId)
      .eq('uom_id', uomId)
      .eq('is_active', true)
      .in('status', ['APPROVED'])
      .is('deleted_at', null)

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async create(data: CreatePricelistDto): Promise<Pricelist> {
    const insertData = {
      company_id: data.company_id,
      supplier_id: data.supplier_id,
      product_id: data.product_id,
      uom_id: data.uom_id,
      price: data.price,
      currency: data.currency || 'IDR',
      valid_from: data.valid_from,
      valid_to: data.valid_to,
      is_active: data.is_active ?? true,
      status: 'APPROVED' as const,
      created_by: data.created_by
    }

    const { data: pricelist, error } = await supabase
      .from('pricelists')
      .insert(insertData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return pricelist
  }

  async updateById(id: string, updates: UpdatePricelistDto & { updated_by?: string }): Promise<Pricelist | null> {
    const { data, error } = await supabase
      .from('pricelists')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'EXPIRED'
  ): Promise<Pricelist | null> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('pricelists')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('pricelists')
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

  async restorePricelist(id: string, userId?: string): Promise<Pricelist> {
    // Get the deleted pricelist first
    const { data: deletedPricelist, error: fetchError } = await supabase
      .from('pricelists')
      .select('*')
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .maybeSingle()

    if (fetchError) throw new Error(fetchError.message)
    if (!deletedPricelist) {
      throw new Error('Deleted pricelist not found')
    }

    // Check for active duplicate
    const duplicate = await this.findActiveDuplicate(
      deletedPricelist.company_id,
      deletedPricelist.supplier_id,
      deletedPricelist.product_id,
      deletedPricelist.uom_id
    )

    if (duplicate) {
      throw new Error('Cannot restore: An active pricelist already exists for this supplier-product-uom combination')
    }

    const { data, error } = await supabase
      .from('pricelists')
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
    return data
  }

  async lookupPrice(lookup: PricelistLookup): Promise<Pricelist | null> {
    const targetDate = lookup.date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('pricelists')
      .select('*')
      .eq('supplier_id', lookup.supplier_id)
      .eq('product_id', lookup.product_id)
      .eq('uom_id', lookup.uom_id)
      .eq('status', 'APPROVED')
      .eq('is_active', true)
      .is('deleted_at', null)
      .lte('valid_from', targetDate)
      .or(`valid_to.is.null,valid_to.gte.${targetDate}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async expireOldPricelists(): Promise<number> {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('pricelists')
      .update({
        status: 'EXPIRED',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'APPROVED')
      .not('valid_to', 'is', null)
      .lt('valid_to', today)
      .is('deleted_at', null)
      .select('id')

    if (error) throw new Error(error.message)
    return data?.length || 0
  }
}

export const pricelistsRepository = new PricelistsRepository()
