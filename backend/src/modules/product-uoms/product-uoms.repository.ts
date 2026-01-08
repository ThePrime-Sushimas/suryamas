import { supabase } from '../../config/supabase'
import { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../products/products.types'

export class ProductUomsRepository {
  async findByProductId(productId: string, includeDeleted = false): Promise<ProductUom[]> {
    let query = supabase
      .from('product_uoms')
      .select('*')
      .eq('product_id', productId)

    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
    }

    const { data, error } = await query.order('is_base_unit', { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  async findByProductIdAndUnitName(productId: string, unitName: string): Promise<ProductUom | null> {
    const { data, error } = await supabase
      .from('product_uoms')
      .select('*')
      .eq('product_id', productId)
      .eq('unit_name', unitName)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByProductIdAndMetricUnit(productId: string, metricUnitId: string): Promise<ProductUom | null> {
    const { data, error } = await supabase
      .from('product_uoms')
      .select('*')
      .eq('product_id', productId)
      .eq('metric_unit_id', metricUnitId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findById(id: string, includeDeleted = false): Promise<ProductUom | null> {
    let query = supabase
      .from('product_uoms')
      .select('*')
      .eq('id', id)

    if (!includeDeleted) {
      query = query.eq('is_deleted', false)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findBaseUom(productId: string): Promise<ProductUom | null> {
    const { data, error } = await supabase
      .from('product_uoms')
      .select('*')
      .eq('product_id', productId)
      .eq('is_base_unit', true)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async create(data: CreateProductUomDto & { product_id: string; unit_name: string; created_by?: string; updated_by?: string }): Promise<ProductUom> {
    const { data: uom, error } = await supabase
      .from('product_uoms')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return uom
  }

  async updateById(id: string, updates: UpdateProductUomDto & { updated_by?: string }): Promise<ProductUom | null> {
    const { data, error } = await supabase
      .from('product_uoms')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('product_uoms').update({ is_deleted: true }).eq('id', id)

    if (error) throw new Error(error.message)
  }

  async restore(id: string): Promise<ProductUom | null> {
    const { data, error } = await supabase
      .from('product_uoms')
      .update({ is_deleted: false })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async clearDefaultBaseUnit(productId: string): Promise<void> {
    const { error } = await supabase
      .from('product_uoms')
      .update({ is_default_base_unit: false })
      .eq('product_id', productId)
      .eq('is_deleted', false)

    if (error) throw new Error(error.message)
  }

  async findDefaultByProduct(
    productId: string,
    field: 'is_default_stock_unit' | 'is_default_purchase_unit' | 'is_default_transfer_unit'
  ): Promise<ProductUom | null> {
    // Use limit to ensure we only get one row, avoiding multiple row errors
    const { data, error } = await supabase
      .from('product_uoms')
      .select('*')
      .eq('product_id', productId)
      .eq(field, true)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }
}

export const productUomsRepository = new ProductUomsRepository()
