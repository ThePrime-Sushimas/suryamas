import { pool } from '../../config/db'
import { EmployeeBranchEntity, EmployeeBranchWithRelations } from './employee_branches.types'
import { mapEmployeeBranch } from './employee_branches.mapper'
import { employeesRepository } from '../employees/employees.repository'

const BASE_SELECT = `
  eb.id, eb.employee_id, eb.branch_id, eb.role_id, eb.is_primary, eb.approval_limit, eb.status, eb.created_at,
  e.full_name AS emp_full_name, e.job_position AS emp_job_position, e.email AS emp_email, e.mobile_phone AS emp_mobile_phone,
  b.branch_name AS br_branch_name, b.branch_code AS br_branch_code, b.company_id AS br_company_id, b.status AS br_status,
  r.name AS role_name, r.description AS role_description
`
const BASE_FROM = `
  FROM employee_branches eb
  JOIN employees e ON e.id = eb.employee_id
  JOIN branches b ON b.id = eb.branch_id
  JOIN perm_roles r ON r.id = eb.role_id
`

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    employees: { full_name: row.emp_full_name, job_position: row.emp_job_position, email: row.emp_email, mobile_phone: row.emp_mobile_phone },
    branches: { branch_name: row.br_branch_name, branch_code: row.br_branch_code, company_id: row.br_company_id, status: row.br_status },
    perm_roles: { name: row.role_name, description: row.role_description },
  }
}

export class EmployeeBranchesRepository {
  async findAll(limit: number, offset: number, search?: string): Promise<{ data: EmployeeBranchWithRelations[]; total: number }> {
    const conditions: string[] = []
    const params: string[] = []
    let idx = 1

    if (search?.trim()) {
      params.push(`%${search}%`)
      conditions.push(`(e.full_name ILIKE $${idx} OR b.branch_name ILIKE $${idx} OR b.branch_code ILIKE $${idx})`)
      idx++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ORDER BY eb.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${BASE_FROM} ${where}`, params)
    ])

    return { data: dataRes.rows.map(r => mapEmployeeBranch(mapRow(r))), total: countRes.rows[0].total }
  }

  async findGroupedByEmployee(limit: number, offset: number, search?: string): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ORDER BY eb.created_at DESC`)
    const mapped = rows.map(r => mapEmployeeBranch(mapRow(r)))

    const grouped = mapped.reduce((acc: Record<string, Record<string, unknown>>, item: EmployeeBranchWithRelations) => {
      if (!acc[item.employee_id]) {
        acc[item.employee_id] = { employee_id: item.employee_id, employee_name: item.employee.full_name, branches: [], primary_branch: null, total_branches: 0 }
      }
      (acc[item.employee_id].branches as EmployeeBranchWithRelations[]).push(item)
      if (item.is_primary) {
        acc[item.employee_id].primary_branch = { branch_id: item.branch_id, branch_name: item.branch.branch_name, branch_code: item.branch.branch_code }
      }
      return acc
    }, {})

    let groupedArray = Object.values(grouped).map(g => ({ ...g, total_branches: (g.branches as unknown[]).length }))

    if (search?.trim()) {
      const s = search.toLowerCase()
      groupedArray = groupedArray.filter((g: Record<string, unknown>) =>
        (g.employee_name as string)?.toLowerCase().includes(s) ||
        (g.branches as EmployeeBranchWithRelations[]).some(b => b.branch.branch_name?.toLowerCase().includes(s) || b.branch.branch_code?.toLowerCase().includes(s))
      )
    }

    const total = groupedArray.length
    return { data: groupedArray.slice(offset, offset + limit), total }
  }

  async findByEmployeeId(employeeId: string): Promise<EmployeeBranchWithRelations[]> {
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE eb.employee_id = $1 ORDER BY eb.is_primary DESC, eb.created_at DESC`, [employeeId])
    return rows.map(r => mapEmployeeBranch(mapRow(r)))
  }

  async findById(id: string): Promise<EmployeeBranchWithRelations | null> {
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE eb.id = $1`, [id])
    return rows[0] ? mapEmployeeBranch(mapRow(rows[0])) : null
  }

  async findByBranchId(branchId: string, limit: number, offset: number): Promise<{ data: EmployeeBranchWithRelations[]; total: number }> {
    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE eb.branch_id = $1 ORDER BY eb.is_primary DESC, eb.created_at DESC LIMIT $2 OFFSET $3`, [branchId, limit, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM employee_branches eb WHERE eb.branch_id = $1`, [branchId])
    ])
    return { data: dataRes.rows.map(r => mapEmployeeBranch(mapRow(r))), total: countRes.rows[0].total }
  }

  async findPrimaryBranch(employeeId: string): Promise<EmployeeBranchWithRelations | null> {
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE eb.employee_id = $1 AND eb.is_primary = true`, [employeeId])
    return rows[0] ? mapEmployeeBranch(mapRow(rows[0])) : null
  }

  async findByEmployeeAndBranch(employeeId: string, branchId: string): Promise<EmployeeBranchEntity | null> {
    const { rows } = await pool.query(
      'SELECT id, employee_id, branch_id, role_id, is_primary, approval_limit, status, created_at FROM employee_branches WHERE employee_id = $1 AND branch_id = $2',
      [employeeId, branchId]
    )
    return (rows[0] as EmployeeBranchEntity) ?? null
  }

  async employeeExists(employeeId: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM employees WHERE id = $1', [employeeId])
    return rows[0].cnt > 0
  }

  async findEmployeeByUserId(userId: string): Promise<{ id: string } | null> {
    return employeesRepository.findByUserId(userId)
  }

  async branchExists(branchId: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM branches WHERE id = $1', [branchId])
    return rows[0].cnt > 0
  }

  async create(data: Omit<EmployeeBranchEntity, 'id' | 'created_at'>): Promise<EmployeeBranchEntity> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const { rows } = await pool.query(
      `INSERT INTO employee_branches (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id, employee_id, branch_id, role_id, is_primary, approval_limit, status, created_at`,
      values
    )
    return rows[0] as EmployeeBranchEntity
  }

  async update(id: string, updates: Partial<Omit<EmployeeBranchEntity, 'id' | 'employee_id' | 'branch_id' | 'created_at'>>): Promise<EmployeeBranchEntity | null> {
    const keys = Object.keys(updates)
    if (!keys.length) { const { rows } = await pool.query('SELECT * FROM employee_branches WHERE id = $1', [id]); return rows[0] ?? null }
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE employee_branches SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING id, employee_id, branch_id, role_id, is_primary, approval_limit, status, created_at`,
      [...values, id]
    )
    return (rows[0] as EmployeeBranchEntity) ?? null
  }

  async setPrimaryBranch(employeeId: string, branchId: string): Promise<void> {
    await this.unsetPrimaryForEmployee(employeeId)
    await pool.query('UPDATE employee_branches SET is_primary = true WHERE employee_id = $1 AND branch_id = $2', [employeeId, branchId])
  }

  async unsetPrimaryForEmployee(employeeId: string): Promise<void> {
    await pool.query('UPDATE employee_branches SET is_primary = false WHERE employee_id = $1', [employeeId])
  }

  async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM employee_branches WHERE id = $1', [id])
  }

  async deleteByEmployeeAndBranch(employeeId: string, branchId: string): Promise<void> {
    await pool.query('DELETE FROM employee_branches WHERE employee_id = $1 AND branch_id = $2', [employeeId, branchId])
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await pool.query('DELETE FROM employee_branches WHERE id = ANY($1::uuid[])', [ids])
  }
}

export const employeeBranchesRepository = new EmployeeBranchesRepository()
