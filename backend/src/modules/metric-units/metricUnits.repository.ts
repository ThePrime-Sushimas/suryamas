import { pool } from '../../config/db'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from './metricUnits.types'
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
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (filter?.metric_type) { params.push(filter.metric_type); conditions.push(`metric_type = $${idx}`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    if (filter?.q) { params.push(`%${filter.q}%`); conditions.push(`(unit_name ILIKE $${idx} OR notes ILIKE $${idx})`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortField = sort?.field && this.sortableFields.includes(sort.field as typeof METRIC_UNIT_CONFIG.SORTABLE_FIELDS[number]) ? sort.field : null
    const orderBy = sortField
      ? `ORDER BY ${sortField} ${sort?.order === 'desc' ? 'DESC' : 'ASC'}`
      : 'ORDER BY metric_type ASC, unit_name ASC, id ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${this.tableName} ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM ${this.tableName} ${where}`, params)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async listActiveFromView(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ data: MetricUnit[]; total: number }> {
    return this.list(pagination, sort, { is_active: true })
  }

  async findById(id: string): Promise<MetricUnit | null> {
    const { rows } = await pool.query(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id])
    return rows[0] ?? null
  }

  async create(dto: CreateMetricUnitDto): Promise<MetricUnit> {
    const keys = Object.keys(dto)
    const values = Object.values(dto)
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        values
      )
      return rows[0]
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw new DuplicateMetricUnitError(dto.metric_type, dto.unit_name)
      throw err
    }
  }

  async updateById(id: string, dto: UpdateMetricUnitDto): Promise<MetricUnit | null> {
    const keys = Object.keys(dto)
    if (!keys.length) return this.findById(id)
    const values = Object.values(dto)
    try {
      const { rows } = await pool.query(
        `UPDATE ${this.tableName} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      )
      return rows[0] ?? null
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw new DuplicateMetricUnitError(dto.metric_type, dto.unit_name)
      throw err
    }
  }

  async delete(id: string): Promise<void> {
    await pool.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id])
  }

  async bulkUpdateStatus(ids: string[], is_active: boolean): Promise<void> {
    if (!ids?.length) throw new Error('No IDs provided for bulk update')
    await pool.query(`UPDATE ${this.tableName} SET is_active = $1 WHERE id = ANY($2::uuid[])`, [is_active, ids])
  }
}

export const metricUnitsRepository = new MetricUnitsRepository()
