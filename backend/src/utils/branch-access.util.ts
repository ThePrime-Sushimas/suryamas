import { pool } from '../config/db'

const branchIdCache = new Map<string, { branches: string[]; expiresAt: number }>()
const branchNameCache = new Map<string, { names: string[]; expiresAt: number }>()
const CACHE_TTL = 30_000 // 30 seconds

export function invalidateBranchCache(userId?: string): void {
  if (userId) {
    branchIdCache.delete(userId)
    branchNameCache.delete(userId)
    companyIdCache.delete(userId)
  } else {
    branchIdCache.clear()
    branchNameCache.clear()
    companyIdCache.clear()
  }
}

export async function getAccessibleBranchIds(userId: string): Promise<string[]> {
  const cached = branchIdCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.branches

  const { rows } = await pool.query(
    `SELECT eb.branch_id FROM employee_branches eb
     JOIN employees e ON e.id = eb.employee_id
     WHERE e.user_id = $1 AND eb.status = 'active'`,
    [userId]
  )

  const branches = rows.map(r => r.branch_id as string)

  // If user has no branch assignment, return impossible UUID to block all data
  if (branches.length === 0) branches.push('00000000-0000-0000-0000-000000000000')

  branchIdCache.set(userId, { branches, expiresAt: Date.now() + CACHE_TTL })
  return branches
}

/**
 * Returns branch names for accessible branches.
 * Used by modules that store branch_name (string) instead of branch_id (UUID),
 * e.g. cash_counts, cash_deposits.
 */
export async function getAccessibleBranchNames(userId: string): Promise<string[]> {
  const cached = branchNameCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.names

  const { rows } = await pool.query(
    `SELECT b.branch_name FROM employee_branches eb
     JOIN employees e ON e.id = eb.employee_id
     JOIN branches b ON b.id = eb.branch_id
     WHERE e.user_id = $1 AND eb.status = 'active'`,
    [userId]
  )

  const names = rows.map(r => r.branch_name as string)
  branchNameCache.set(userId, { names, expiresAt: Date.now() + CACHE_TTL })
  return names
}

const companyIdCache = new Map<string, { companies: string[]; expiresAt: number }>()

/** Distinct company IDs from branches the user can access (for fiscal periods, etc.). */
export async function getAccessibleCompanyIds(userId: string): Promise<string[]> {
  const cached = companyIdCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.companies

  const { rows } = await pool.query(
    `SELECT DISTINCT b.company_id FROM employee_branches eb
     JOIN employees e ON e.id = eb.employee_id
     JOIN branches b ON b.id = eb.branch_id
     WHERE e.user_id = $1 AND eb.status = 'active'`,
    [userId]
  )

  const companies = rows.map(r => r.company_id as string)
  if (companies.length === 0) companies.push('00000000-0000-0000-0000-000000000000')

  companyIdCache.set(userId, { companies, expiresAt: Date.now() + CACHE_TTL })
  return companies
}

export async function getCompanyIdForBranch(branchId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT company_id FROM branches WHERE id = $1 AND deleted_at IS NULL`,
    [branchId]
  )
  return (rows[0]?.company_id as string) ?? null
}

export function requireBranchAccess(branchId: string, accessibleBranchIds: string[]): void {
  if (!accessibleBranchIds.includes(branchId)) {
    const err = new Error('No access to this branch') as Error & { statusCode?: number }
    err.statusCode = 403
    throw err
  }
}

export function isBranchAccessible(branchId: string | null | undefined, accessibleBranchIds: string[]): boolean {
  if (!branchId) return false
  return accessibleBranchIds.includes(branchId)
}

/** Active-branch company for writes (bank import, cash flow groups, etc.). */
export function resolveContextCompanyId(contextCompanyId: string, companyIds: string[]): string {
  if (contextCompanyId && companyIds.includes(contextCompanyId)) return contextCompanyId
  return companyIds[0] ?? ''
}

export function requireCompanyAccess(companyId: string, accessibleCompanyIds: string[]): void {
  if (!accessibleCompanyIds.includes(companyId)) {
    const err = new Error('No access to this company') as Error & { statusCode?: number }
    err.statusCode = 403
    throw err
  }
}

/** Branch + company scope for a user (list/detail/mutations). */
export async function getAccessScope(userId: string): Promise<{ branchIds: string[]; companyIds: string[] }> {
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return { branchIds, companyIds }
}
