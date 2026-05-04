import { pool } from '../../config/db'

export interface HrdSummary {
  total_employees: number
  active_employees: number
  active_branches: number
  multi_branch_count: number
}

export interface BranchPositionRow {
  branch_id: string
  branch_name: string
  job_position: string
  count: number
}

export interface PositionRow {
  job_position: string
  count: number
}

export interface MultiBranchEmployee {
  employee_id: string
  full_name: string
  job_position: string
  role_name: string | null
  branch_count: number
  branches: string[]
}

class DashboardHrdRepository {
  async getSummary(companyId: string): Promise<HrdSummary> {
    const { rows } = await pool.query(
      `SELECT
        (SELECT COUNT(DISTINCT e.id) FROM employees e
         JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
         JOIN branches b ON b.id = eb.branch_id AND b.company_id = $1
         WHERE e.deleted_at IS NULL AND e.full_name NOT IN ('test'))::int AS total_employees,
        (SELECT COUNT(DISTINCT e.id) FROM employees e
         JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
         JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
         WHERE e.deleted_at IS NULL AND e.is_active = true AND e.full_name NOT IN ('test'))::int AS active_employees,
        (SELECT COUNT(*) FROM branches WHERE status = 'active' AND company_id = $1)::int AS active_branches,
        (SELECT COUNT(*) FROM (
          SELECT eb.employee_id FROM employee_branches eb
          JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
          JOIN employees e ON e.id = eb.employee_id AND e.deleted_at IS NULL AND e.full_name NOT IN ('test')
          WHERE eb.status = 'active'
          GROUP BY eb.employee_id HAVING COUNT(DISTINCT eb.branch_id) > 1
        ) x)::int AS multi_branch_count`,
      [companyId]
    )
    return rows[0]
  }

  async getBranchPositions(companyId: string): Promise<BranchPositionRow[]> {
    const { rows } = await pool.query(
      `SELECT b.id AS branch_id, b.branch_name, UPPER(COALESCE(e.job_position, 'UNKNOWN')) AS job_position, COUNT(DISTINCT e.id)::int AS count
       FROM employee_branches eb
       JOIN employees e ON e.id = eb.employee_id AND e.deleted_at IS NULL AND e.full_name NOT IN ('test')
       JOIN branches b ON b.id = eb.branch_id AND b.status = 'active'
       WHERE eb.status = 'active' AND eb.is_primary = true AND b.company_id = $1
         AND LENGTH(TRIM(COALESCE(e.job_position, ''))) > 2
       GROUP BY b.id, b.branch_name, UPPER(COALESCE(e.job_position, 'UNKNOWN'))
       ORDER BY b.branch_name, count DESC`,
      [companyId]
    )
    return rows
  }

  async getPositionSummary(companyId: string): Promise<PositionRow[]> {
    const { rows } = await pool.query(
      `SELECT UPPER(COALESCE(e.job_position, 'UNKNOWN')) AS job_position, COUNT(DISTINCT e.id)::int AS count
       FROM employees e
       JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active' AND eb.is_primary = true
       JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
       WHERE e.deleted_at IS NULL AND e.full_name NOT IN ('test')
         AND e.job_position IS NOT NULL AND LENGTH(TRIM(e.job_position)) > 2
       GROUP BY UPPER(COALESCE(e.job_position, 'UNKNOWN'))
       ORDER BY count DESC`,
      [companyId]
    )
    return rows
  }

  async getMultiBranchEmployees(companyId: string): Promise<MultiBranchEmployee[]> {
    const { rows } = await pool.query(
      `SELECT e.id AS employee_id, e.full_name, UPPER(COALESCE(e.job_position, 'UNKNOWN')) AS job_position,
        (SELECT r.name FROM perm_roles r
         JOIN employee_branches eb2 ON eb2.role_id = r.id
         WHERE eb2.employee_id = e.id AND eb2.is_primary = true LIMIT 1) AS role_name,
        COUNT(DISTINCT eb.branch_id)::int AS branch_count,
        ARRAY_AGG(DISTINCT b.branch_name ORDER BY b.branch_name) AS branches
       FROM employees e
       JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
       JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
       WHERE e.deleted_at IS NULL AND e.full_name NOT IN ('test')
       GROUP BY e.id, e.full_name, e.job_position
       HAVING COUNT(DISTINCT eb.branch_id) > 1
       ORDER BY branch_count DESC, e.full_name`,
      [companyId]
    )
    return rows
  }
}

export const dashboardHrdRepository = new DashboardHrdRepository()
