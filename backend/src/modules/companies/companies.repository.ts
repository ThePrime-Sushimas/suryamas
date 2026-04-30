import { pool } from '../../config/db'
import { Company, CreateCompanyDTO, UpdateCompanyDTO } from './companies.types'

export class CompaniesRepository {
  private buildFilter(filter?: { search?: string; status?: string; company_type?: string }): { conditions: string[]; params: (string)[] } {
    const conditions: string[] = []
    const params: string[] = []
    let idx = 1

    if (filter?.search) {
      params.push(`%${filter.search}%`)
      conditions.push(`(company_name ILIKE $${idx} OR company_code ILIKE $${idx})`)
      idx++
    }
    if (filter?.status) { params.push(filter.status); conditions.push(`status = $${idx}`); idx++ }
    if (filter?.company_type) { params.push(filter.company_type); conditions.push(`company_type = $${idx}`); idx++ }

    return { conditions, params }
  }

  async findAll(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: { search?: string; status?: string; company_type?: string }): Promise<{ data: Company[]; total: number }> {
    const validFields = ['company_name', 'company_code', 'status', 'company_type', 'created_at']
    const sortField = sort && validFields.includes(sort.field) ? sort.field : 'company_name'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'
    const { conditions, params } = this.buildFilter(filter)
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM companies ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM companies ${where}`, params)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(searchTerm: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: { status?: string; company_type?: string }): Promise<{ data: Company[]; total: number }> {
    return this.findAll(pagination, sort, { ...filter, search: searchTerm })
  }

  async create(data: CreateCompanyDTO): Promise<Company | null> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const cols = keys.join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(`INSERT INTO companies (${cols}) VALUES (${placeholders}) RETURNING *`, values)
    return rows[0]
  }

  invalidateCache(): void {}

  async findById(id: string): Promise<Company | null> {
    const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [id])
    return rows[0] ?? null
  }

  async findByCode(code: string): Promise<Company | null> {
    const { rows } = await pool.query('SELECT * FROM companies WHERE company_code = $1', [code])
    return rows[0] ?? null
  }

  async findByNpwp(npwp: string): Promise<Company | null> {
    const { rows } = await pool.query('SELECT * FROM companies WHERE npwp = $1', [npwp])
    return rows[0] ?? null
  }

  async update(id: string, updates: UpdateCompanyDTO): Promise<Company | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(`UPDATE companies SET ${set} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
    return rows[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await pool.query("UPDATE companies SET status = 'inactive' WHERE id = $1", [id])
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    await pool.query('UPDATE companies SET status = $1 WHERE id = ANY($2::uuid[])', [status, ids])
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await pool.query('DELETE FROM companies WHERE id = ANY($1::uuid[])', [ids])
  }

  async exportData(filter?: { status?: string; company_type?: string }, limit = 10000): Promise<Company[]> {
    const { conditions, params } = this.buildFilter(filter)
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(`SELECT * FROM companies ${where} LIMIT $${params.length + 1}`, [...params, limit])
    return rows
  }

  async bulkCreate(companies: CreateCompanyDTO[]): Promise<void> {
    if (!companies.length) return
    const keys = [...new Set(companies.flatMap(c => Object.keys(c)))]
    const cols = keys.join(', ')
    const placeholders = companies.map((_, i) =>
      `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`
    ).join(', ')
    const values = companies.flatMap(c => {
      const record = c as unknown as Record<string, unknown>
      return keys.map(k => record[k] ?? null)
    })
    await pool.query(`INSERT INTO companies (${cols}) VALUES ${placeholders}`, values)
  }

  async getFilterOptions(): Promise<{ statuses: string[]; types: string[] }> {
    return { statuses: ['active', 'inactive', 'suspended', 'closed'], types: ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan'] }
  }
}

export const companiesRepository = new CompaniesRepository()
