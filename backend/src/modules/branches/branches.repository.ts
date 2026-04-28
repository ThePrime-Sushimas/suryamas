import { pool } from '../../config/db'
import { Branch, CreateBranchDto, UpdateBranchDto } from './branches.types'

export class BranchesRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { status?: string; company_id?: string; city?: string; hari_operasional?: string }
  ): Promise<{ data: Branch[]; total: number }> {
    const validFields = ['branch_name', 'branch_code', 'status', 'city', 'hari_operasional', 'created_at']
    const sortField = sort && validFields.includes(sort.field) ? sort.field : 'branch_name'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

    const conditions: string[] = []
    const params: any[] = []

    if (filter?.status) { params.push(filter.status); conditions.push(`status = $${params.length}`) }
    if (filter?.company_id) { params.push(filter.company_id); conditions.push(`company_id = $${params.length}`) }
    if (filter?.city) { params.push(filter.city); conditions.push(`city = $${params.length}`) }
    if (filter?.hari_operasional) {
      params.push(JSON.stringify([filter.hari_operasional]))
      conditions.push(`hari_operasional @> $${params.length}::jsonb`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM branches ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM branches ${where}`, params)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(
    searchTerm: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ): Promise<{ data: Branch[]; total: number }> {
    const validFields = ['branch_name', 'branch_code', 'status', 'city', 'hari_operasional', 'created_at']
    const sortField = sort && validFields.includes(sort.field) ? sort.field : 'branch_name'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

    const conditions: string[] = []
    const params: any[] = []

    if (searchTerm && searchTerm.trim()) {
      params.push(`%${searchTerm}%`)
      const idx = params.length
      conditions.push(`(branch_name ILIKE $${idx} OR branch_code ILIKE $${idx})`)
    }

    if (filter?.status) {
      params.push(filter.status)
      conditions.push(`status = $${params.length}`)
    }
    if (filter?.company_id) {
      params.push(filter.company_id)
      conditions.push(`company_id = $${params.length}`)
    }
    if (filter?.city) {
      params.push(filter.city)
      conditions.push(`city = $${params.length}`)
    }
    if (filter?.hari_operasional) {
      params.push(JSON.stringify([filter.hari_operasional]))
      conditions.push(`hari_operasional @> $${params.length}::jsonb`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM branches ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM branches ${where}`, params)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string): Promise<Branch | null> {
    const { rows } = await pool.query(`SELECT * FROM branches WHERE id = $1`, [id])
    return rows[0] ?? null
  }

  async findByBranchCode(code: string): Promise<Branch | null> {
    const { rows } = await pool.query(`SELECT * FROM branches WHERE branch_code = $1`, [code])
    return rows[0] ?? null
  }

  async create(data: CreateBranchDto): Promise<Branch> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const cols = keys.join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO branches (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: string, updates: UpdateBranchDto): Promise<Branch | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `UPDATE branches SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    try {
      await pool.query(`DELETE FROM branches WHERE id = $1`, [id])
    } catch (err: any) {
      if (err.code === '23503') {
        throw new Error('Branch is referenced and cannot be deleted')
      }
      throw err
    }
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    await pool.query(
      `UPDATE branches SET status = $1 WHERE id = ANY($2::uuid[])`,
      [status, ids]
    )
  }

  async exportData(filter?: any): Promise<Branch[]> {
    const conditions: string[] = []
    const params: any[] = []

    if (filter?.status) { params.push(filter.status); conditions.push(`status = $${params.length}`) }
    if (filter?.company_id) { params.push(filter.company_id); conditions.push(`company_id = $${params.length}`) }
    if (filter?.city) { params.push(filter.city); conditions.push(`city = $${params.length}`) }
    if (filter?.hari_operasional) {
      params.push(JSON.stringify([filter.hari_operasional]))
      conditions.push(`hari_operasional @> $${params.length}::jsonb`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(`SELECT * FROM branches ${where}`, params)
    return rows
  }

  async getFilterOptions(): Promise<{ cities: string[]; statuses: string[]; hariOperasional: string[] }> {
    const { rows } = await pool.query(`SELECT city, status, hari_operasional FROM branches`)

    const cities = [...new Set(rows.map((b: any) => b.city).filter(Boolean))] as string[]
    const statuses = [...new Set(rows.map((b: any) => b.status).filter(Boolean))] as string[]
    const hariOperasionalFlat = rows.flatMap((b: any) =>
      Array.isArray(b.hari_operasional) ? b.hari_operasional : []
    )
    const hariOperasional = [...new Set(hariOperasionalFlat)] as string[]

    cities.sort(); statuses.sort(); hariOperasional.sort()
    return { cities, statuses, hariOperasional }
  }

  async bulkCreate(branches: CreateBranchDto[]): Promise<void> {
    if (!branches.length) return
    const keys = [...new Set(branches.flatMap(b => Object.keys(b)))]
    const cols = keys.join(', ')
    const placeholders = branches.map((_, i) =>
      `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`
    ).join(', ')
    const values = branches.flatMap(b => keys.map(k => (b as any)[k] ?? null))
    await pool.query(`INSERT INTO branches (${cols}) VALUES ${placeholders}`, values)
  }

  async minimalActive(): Promise<{ id: string; branch_name: string }[]> {
    const { rows } = await pool.query(
      `SELECT id, branch_name FROM branches WHERE status = 'active' ORDER BY branch_name LIMIT 1000`
    )
    return rows
  }

  async findByName(name: string): Promise<Branch | null> {
    const { rows } = await pool.query(
      'SELECT * FROM branches WHERE branch_name ILIKE $1 AND status = \'active\' LIMIT 1',
      [name.trim()]
    )
    return rows[0] || null
  }
}

export const branchesRepository = new BranchesRepository()
