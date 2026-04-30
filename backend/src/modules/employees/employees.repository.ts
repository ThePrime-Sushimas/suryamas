import { pool } from '../../config/db'
import { storageService } from '../../services/storage.service'
import { EmployeeDB, EmployeeWithBranch, EmployeeFilter, PaginationParams } from './employees.types'

export class EmployeesRepository {
  private static filterOptionsCache: { branches: { id: string; branch_name: string }[]; positions: string[]; statuses: string[] } | null = null
  private static filterOptionsCacheExpiry = 0
  private static readonly CACHE_TTL = 30 * 60 * 1000

  async findAll(params: PaginationParams): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const { page, limit, sort = 'full_name', order = 'asc' } = params
    const validFields = ['employee_id', 'full_name', 'job_position', 'email', 'mobile_phone', 'join_date', 'is_active', 'created_at', 'id']
    const sortField = validFields.includes(sort) ? `e.${sort}` : 'e.full_name'
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC'
    const offset = (page - 1) * limit

    const baseQuery = `
      FROM employees e
      LEFT JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
      LEFT JOIN branches b ON b.id = eb.branch_id
      WHERE e.deleted_at IS NULL
    `

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT e.*, b.branch_name, b.branch_code, b.city AS branch_city ${baseQuery} ORDER BY ${sortField} ${sortOrder} LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${baseQuery}`)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findUnassigned(params: { page: number; limit: number }): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const offset = (params.page - 1) * params.limit

    const baseQuery = `
      FROM employees e
      LEFT JOIN employee_branches eb ON eb.employee_id = e.id
      WHERE e.deleted_at IS NULL AND eb.id IS NULL
    `

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT e.*, NULL AS branch_name, NULL AS branch_code, NULL AS branch_city ${baseQuery} ORDER BY e.full_name LIMIT $1 OFFSET $2`, [params.limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${baseQuery}`)
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async create(data: Partial<EmployeeDB>): Promise<EmployeeDB> {
    const keys = Object.keys(data)
    if (!keys.length) throw new Error('No data to insert')
    const values = Object.values(data)
    const cols = keys.join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

    try {
      const { rows } = await pool.query(`INSERT INTO employees (${cols}) VALUES (${placeholders}) RETURNING *`, values)
      EmployeesRepository.filterOptionsCache = null
      return rows[0]
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') throw new Error('Employee ID already exists')
      throw err
    }
  }

  async findById(id: string): Promise<EmployeeWithBranch | null> {
    const { rows } = await pool.query(
      `SELECT e.*, b.branch_name, b.branch_code, b.city AS branch_city
       FROM employees e
       LEFT JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
       LEFT JOIN branches b ON b.id = eb.branch_id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    )
    return rows[0] ?? null
  }

  async findByUserId(userId: string): Promise<EmployeeWithBranch | null> {
    const { rows } = await pool.query(
      `SELECT e.*, b.branch_name, b.branch_code, b.city AS branch_city
       FROM employees e
       LEFT JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
       LEFT JOIN branches b ON b.id = eb.branch_id
       WHERE e.user_id = $1 AND e.deleted_at IS NULL`,
      [userId]
    )
    return rows[0] ?? null
  }

  async search(searchTerm: string, params: PaginationParams, filter?: EmployeeFilter): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const { page, limit, sort = 'full_name', order = 'asc' } = params
    const validFields = ['employee_id', 'full_name', 'job_position', 'email', 'mobile_phone', 'join_date', 'is_active', 'created_at', 'id']
    const sortField = validFields.includes(sort) ? `e.${sort}` : 'e.full_name'
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC'

    const conditions: string[] = []
    const queryParams: (string | boolean | number)[] = []
    let idx = 1

    const joinType = filter?.branch_name ? 'JOIN' : 'LEFT JOIN'

    if (!filter?.include_deleted) {
      conditions.push('e.deleted_at IS NULL')
    }

    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`)
      conditions.push(`(e.employee_id ILIKE $${idx} OR e.full_name ILIKE $${idx} OR e.email ILIKE $${idx} OR e.mobile_phone ILIKE $${idx})`)
      idx++
    }

    if (filter?.branch_name) {
      queryParams.push(filter.branch_name)
      conditions.push(`b.branch_name = $${idx} AND eb.is_primary = true`)
      idx++
    }
    if (filter?.job_position) {
      queryParams.push(filter.job_position)
      conditions.push(`e.job_position ILIKE $${idx}`)
      idx++
    }
    if (filter?.status_employee) {
      queryParams.push(filter.status_employee)
      conditions.push(`e.status_employee = $${idx}`)
      idx++
    }
    if (filter?.is_active !== undefined) {
      queryParams.push(filter.is_active)
      conditions.push(`e.is_active = $${idx}`)
      idx++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const baseQuery = `
      FROM employees e
      ${joinType} employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
      ${joinType} branches b ON b.id = eb.branch_id
      ${where}
    `

    const offset = (page - 1) * limit
    queryParams.push(limit, offset)

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT e.*, b.branch_name, b.branch_code, b.city AS branch_city ${baseQuery} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, queryParams),
      pool.query(`SELECT COUNT(*)::int AS total ${baseQuery}`, queryParams.slice(0, -2))
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async autocomplete(query: string): Promise<{ id: string; full_name: string }[]> {
    const { rows } = await pool.query(
      `SELECT id, full_name FROM employees WHERE full_name ILIKE $1 AND deleted_at IS NULL ORDER BY full_name LIMIT 10`,
      [`%${query}%`]
    )
    return rows
  }

  async update(userId: string, updates: Partial<EmployeeDB>): Promise<EmployeeDB> {
    const keys = Object.keys(updates)
    if (!keys.length) {
      const { rows } = await pool.query('SELECT * FROM employees WHERE user_id = $1', [userId])
      return rows[0]
    }
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `UPDATE employees SET ${set} WHERE user_id = $${keys.length + 1} RETURNING *`,
      [...values, userId]
    )
    EmployeesRepository.filterOptionsCache = null
    return rows[0]
  }

  async updateById(id: string, updates: Partial<EmployeeDB>): Promise<EmployeeDB> {
    const keys = Object.keys(updates)
    if (!keys.length) {
      const { rows } = await pool.query('SELECT * FROM employees WHERE id = $1', [id])
      return rows[0]
    }
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `UPDATE employees SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    EmployeesRepository.filterOptionsCache = null
    return rows[0]
  }

  async delete(id: string): Promise<void> {
    await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = $1', [id])
    EmployeesRepository.filterOptionsCache = null
  }

  async restore(id: string): Promise<void> {
    await pool.query('UPDATE employees SET deleted_at = NULL WHERE id = $1', [id])
    EmployeesRepository.filterOptionsCache = null
  }

  async getFilterOptions(): Promise<{ branches: { id: string; branch_name: string }[]; positions: string[]; statuses: string[] }> {
    if (EmployeesRepository.filterOptionsCache && EmployeesRepository.filterOptionsCacheExpiry > Date.now()) {
      return EmployeesRepository.filterOptionsCache
    }

    const [empRes, branchRes] = await Promise.all([
      pool.query("SELECT DISTINCT LOWER(job_position) AS job_position FROM employees WHERE is_active = true AND deleted_at IS NULL AND job_position IS NOT NULL"),
      pool.query("SELECT id, branch_name FROM branches WHERE status = 'active' ORDER BY branch_name")
    ])

    const branches = branchRes.rows
    const positions = empRes.rows.map((r: { job_position: string }) => r.job_position).sort()
    const statuses = ['Permanent', 'Contract']

    const result = { branches, positions, statuses }
    EmployeesRepository.filterOptionsCache = result
    EmployeesRepository.filterOptionsCacheExpiry = Date.now() + EmployeesRepository.CACHE_TTL
    return result
  }

  async exportData(filter?: EmployeeFilter): Promise<EmployeeWithBranch[]> {
    const conditions: string[] = ['e.deleted_at IS NULL']
    const params: (string | boolean)[] = []
    let idx = 1
    const joinType = filter?.branch_name ? 'JOIN' : 'LEFT JOIN'

    if (filter?.include_deleted) conditions.shift()

    if (filter?.search) {
      params.push(`%${filter.search}%`)
      conditions.push(`(e.employee_id ILIKE $${idx} OR e.full_name ILIKE $${idx} OR e.email ILIKE $${idx} OR e.mobile_phone ILIKE $${idx})`)
      idx++
    }
    if (filter?.branch_name) {
      params.push(filter.branch_name)
      conditions.push(`b.branch_name = $${idx} AND eb.is_primary = true`)
      idx++
    }
    if (filter?.is_active !== undefined) {
      params.push(filter.is_active)
      conditions.push(`e.is_active = $${idx}`)
      idx++
    }
    if (filter?.status_employee) {
      params.push(filter.status_employee)
      conditions.push(`e.status_employee = $${idx}`)
      idx++
    }
    if (filter?.job_position) {
      params.push(filter.job_position)
      conditions.push(`e.job_position ILIKE $${idx}`)
      idx++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT e.*, b.branch_name, b.branch_code, b.city AS branch_city
       FROM employees e
       ${joinType} employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
       ${joinType} branches b ON b.id = eb.branch_id
       ${where}
       ORDER BY e.full_name`,
      params
    )
    return rows
  }

  async bulkCreate(employees: Partial<EmployeeDB>[]): Promise<void> {
    if (!employees.length) return
    const keys = [...new Set(employees.flatMap(e => Object.keys(e)))]
    const cols = keys.join(', ')
    const placeholders = employees.map((_, i) =>
      `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`
    ).join(', ')
    const values = employees.flatMap(e => keys.map(k => (e as Record<string, unknown>)[k] ?? null))
    await pool.query(`INSERT INTO employees (${cols}) VALUES ${placeholders}`, values)
    EmployeesRepository.filterOptionsCache = null
  }

  async bulkUpdateActive(ids: string[], isActive: boolean): Promise<void> {
    await pool.query('UPDATE employees SET is_active = $1 WHERE id = ANY($2::uuid[])', [isActive, ids])
    EmployeesRepository.filterOptionsCache = null
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = ANY($1::uuid[])', [ids])
    EmployeesRepository.filterOptionsCache = null
  }

  async bulkRestore(ids: string[]): Promise<void> {
    await pool.query('UPDATE employees SET deleted_at = NULL WHERE id = ANY($1::uuid[])', [ids])
    EmployeesRepository.filterOptionsCache = null
  }

  async generateEmployeeId(branchName: string, joinDate: string, jobPosition: string): Promise<string> {
    const { rows } = await pool.query(
      'SELECT generate_employee_id($1::text, $2::date, $3::text) AS id',
      [branchName, joinDate, jobPosition]
    )
    if (!rows[0]?.id) throw new Error('Failed to generate employee ID')
    return rows[0].id
  }

  async uploadFile(fileName: string, buffer: Buffer, contentType: string) {
    return storageService.upload(buffer, fileName, contentType, 'profilepictures')
  }

  getPublicUrl(fileName: string): string {
    return storageService.getPublicUrl(fileName)
  }
}

export const employeesRepository = new EmployeesRepository()
