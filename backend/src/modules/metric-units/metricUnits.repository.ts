import { supabase } from '../../config/supabase'
import { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from './metricUnits.types'

export class MetricUnitsRepository {
  async list(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ): Promise<{ data: MetricUnit[]; total: number }> {
    let query = supabase.from('metric_units').select('*')
    let countQuery = supabase.from('metric_units').select('id', { count: 'exact', head: true })

    if (filter?.metric_type) {
      query = query.eq('metric_type', filter.metric_type)
      countQuery = countQuery.eq('metric_type', filter.metric_type)
    }

    if (filter?.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active)
      countQuery = countQuery.eq('is_active', filter.is_active)
    }

    if (filter?.q) {
      const searchTerm = `%${filter.q}%`
      query = query.or(`unit_name.ilike.${searchTerm},notes.ilike.${searchTerm}`)
      countQuery = countQuery.or(`unit_name.ilike.${searchTerm},notes.ilike.${searchTerm}`)
    }

    if (sort?.field && ['metric_type', 'unit_name', 'is_active', 'id', 'created_at', 'updated_at'].includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('metric_type', { ascending: true }).order('unit_name', { ascending: true }).order('id', { ascending: true })
    }

    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)

    const [{ data, error }, { count }] = await Promise.all([query, countQuery])

    if (error) throw error
    return { data: data || [], total: count || 0 }
  }

  async listActiveFromView(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ data: MetricUnit[]; total: number }> {
    let query = supabase.from('metric_units').select('*').eq('is_active', true)

    if (sort?.field && ['metric_type', 'unit_name', 'id', 'created_at', 'updated_at'].includes(sort.field)) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('metric_type', { ascending: true }).order('unit_name', { ascending: true })
    }

    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)

    const { data, error } = await query
    if (error) throw error

    const { count } = await supabase.from('metric_units').select('id', { count: 'exact', head: true }).eq('is_active', true)

    return { data: data || [], total: count || 0 }
  }

  async findById(id: string): Promise<MetricUnit | null> {
    const { data, error } = await supabase.from('metric_units').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }

  async create(dto: CreateMetricUnitDto): Promise<MetricUnit> {
    const { data, error } = await supabase.from('metric_units').insert([dto]).select().single()
    if (error) throw error
    return data
  }

  async updateById(id: string, dto: UpdateMetricUnitDto): Promise<MetricUnit> {
    const { data, error } = await supabase.from('metric_units').update(dto).eq('id', id).select().maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Failed to update')
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('metric_units').delete().eq('id', id)
    if (error) throw error
  }

  async bulkUpdateStatus(ids: string[], is_active: boolean): Promise<void> {
    const { error } = await supabase.from('metric_units').update({ is_active }).in('id', ids)
    if (error) throw error
  }

  async isDuplicate(metric_type: string, unit_name: string, excludeId?: string): Promise<boolean> {
    let query = supabase.from('metric_units').select('id', { count: 'exact', head: true }).eq('metric_type', metric_type).eq('unit_name', unit_name)
    if (excludeId) query = query.neq('id', excludeId)
    const { count, error } = await query
    if (error) throw error
    return (count || 0) > 0
  }
}

export const metricUnitsRepository = new MetricUnitsRepository()
