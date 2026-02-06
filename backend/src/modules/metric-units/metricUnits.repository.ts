import { supabase } from '../../config/supabase'
import { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from './metricUnits.types'
import { METRIC_UNIT_CONFIG } from './metricUnits.constants'
import { DuplicateMetricUnitError } from './metric-units.errors'

export class MetricUnitsRepository {
  private readonly tableName = METRIC_UNIT_CONFIG.TABLE_NAME
  private readonly sortableFields = METRIC_UNIT_CONFIG.SORTABLE_FIELDS

  async list(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { metric_type?: string; is_active?: boolean; q?: string }
  ): Promise<{ data: MetricUnit[]; total: number }> {
    let query = supabase.from(this.tableName).select('*')
    let countQuery = supabase.from(this.tableName).select('id', { count: 'exact', head: true })

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

    if (sort?.field && this.sortableFields.includes(sort.field as typeof METRIC_UNIT_CONFIG.SORTABLE_FIELDS[number])) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('metric_type', { ascending: true }).order('unit_name', { ascending: true }).order('id', { ascending: true })
    }

    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)

    const [{ data, error }, { count, error: countError }] = await Promise.all([query, countQuery])

    if (error) throw error
    if (countError) throw countError
    return { data: data || [], total: count || 0 }
  }

  async listActiveFromView(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ data: MetricUnit[]; total: number }> {
    let query = supabase.from(this.tableName).select('*').eq('is_active', true)
    let countQuery = supabase.from(this.tableName).select('id', { count: 'exact', head: true }).eq('is_active', true)

    if (sort?.field && this.sortableFields.includes(sort.field as typeof METRIC_UNIT_CONFIG.SORTABLE_FIELDS[number])) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('metric_type', { ascending: true }).order('unit_name', { ascending: true }).order('id', { ascending: true })
    }

    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)

    const [{ data, error }, { count }] = await Promise.all([query, countQuery])

    if (error) throw error
    return { data: data || [], total: count || 0 }
  }

  async findById(id: string): Promise<MetricUnit | null> {
    const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }

  async create(dto: CreateMetricUnitDto): Promise<MetricUnit> {
    const { data, error } = await supabase.from(this.tableName).insert([dto]).select().single()
    if (error) {
      if (error.code === '23505') {
        throw new DuplicateMetricUnitError(dto.metric_type, dto.unit_name)
      }
      throw error
    }
    return data
  }

  async updateById(id: string, dto: UpdateMetricUnitDto): Promise<MetricUnit | null> {
    const { data, error } = await supabase.from(this.tableName).update(dto).eq('id', id).select().maybeSingle()
    if (error) {
      if (error.code === '23505') {
        throw new DuplicateMetricUnitError(dto.metric_type, dto.unit_name)
      }
      throw error
    }
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.tableName).delete().eq('id', id)
    if (error) throw error
  }

  async bulkUpdateStatus(ids: string[], is_active: boolean): Promise<void> {
    if (!ids || ids.length === 0) {
      throw new Error('No IDs provided for bulk update')
    }
    const { error } = await supabase.from(this.tableName).update({ is_active }).in('id', ids)
    if (error) throw error
  }
}

export const metricUnitsRepository = new MetricUnitsRepository()
