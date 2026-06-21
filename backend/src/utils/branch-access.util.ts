import type { Request } from 'express'
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
    `SELECT company_id FROM branches WHERE id = $1`,
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

/** POS aggregates may use branch_id or branch_name without company_id */
export function assertAggregatedTransactionBranchAccess(
  tx: { branch_id?: string | null; branch_name?: string | null },
  accessibleBranchIds: string[],
  accessibleBranchNames: string[]
): void {
  if (tx.branch_id) {
    requireBranchAccess(tx.branch_id, accessibleBranchIds)
    return
  }
  if (tx.branch_name) {
    const name = tx.branch_name.trim().toLowerCase()
    const allowed = accessibleBranchNames.map((n) => n.trim().toLowerCase())
    if (!allowed.includes(name)) {
      const err = new Error('No access to this branch') as Error & { statusCode?: number }
      err.statusCode = 403
      throw err
    }
    return
  }
  const err = new Error('No access to this transaction branch') as Error & { statusCode?: number }
  err.statusCode = 403
  throw err
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

export type ReadScope = { userId: string; companyIds: string[] }
export type WriteScope = ReadScope & { companyId: string }
export type BranchReadScope = ReadScope & { branchIds: string[] }

/** Multi-company read scope from request (list/detail). */
export async function getReadScope(req: Request): Promise<ReadScope> {
  const userId = req.user?.id ?? ''
  const companyIds = await getAccessibleCompanyIds(userId)
  return { userId, companyIds }
}

/** Read scope including branch IDs (warehouses, branch-filtered lists). */
export async function getBranchReadScope(req: Request): Promise<BranchReadScope> {
  const userId = req.user?.id ?? ''
  const [companyIds, branchIds] = await Promise.all([
    getAccessibleCompanyIds(userId),
    getAccessibleBranchIds(userId),
  ])
  return { userId, companyIds, branchIds }
}

/** Single company for writes using header branch context. */
export async function getWriteScope(req: Request): Promise<WriteScope> {
  const scope = await getReadScope(req)
  const companyId = resolveContextCompanyId(req.context?.company_id ?? '', scope.companyIds)
  if (!companyId) throw new Error('Branch context required')
  return { ...scope, companyId }
}

// ── Central Branch ──

export interface CentralBranchOption {
  id: string
  branch_code: string
  branch_name: string
}

/**
 * Returns all Central branches for a company.
 * A company may have zero, one, or multiple Central branches.
 *
 * Caller (UI-facing service) is responsible for:
 * - If 0 results: surface error to user (no Central configured)
 * - If 1 result: may auto-select without prompting user
 * - If 2+ results: must prompt user to choose via dropdown
 */
export async function getCentralBranches(companyId: string): Promise<CentralBranchOption[]> {
  const { rows } = await pool.query(
    `SELECT id, branch_code, branch_name
     FROM branches
     WHERE company_id = $1 AND is_central = true AND status = 'active'
     ORDER BY branch_name`,
    [companyId]
  )
  return rows
}

/**
 * Validates that a given branch_id is a valid Central branch for the specified company.
 * Used by services that receive branch_id from user request and need defensive validation.
 *
 * @throws BusinessRuleError if branch is not a valid Central for this company
 */
export async function requireCentralBranch(branchId: string, companyId: string): Promise<void> {
  const centrals = await getCentralBranches(companyId)
  if (!centrals.some(b => b.id === branchId)) {
    const err = new Error('Branch yang dipilih bukan Central branch yang valid untuk company ini') as Error & { statusCode?: number }
    err.statusCode = 400
    throw err
  }
}

/**
 * Resolves the Central branch_id for a service call.
 * - If branchId provided by user: validates it's a valid Central
 * - If not provided and exactly 1 Central: auto-selects
 * - If not provided and 0 or 2+ Centrals: throws descriptive error
 *
 * @returns resolved branch_id (guaranteed valid Central for this company)
 */
export async function resolveCentralBranchId(companyId: string, userProvidedBranchId?: string): Promise<string> {
  const centrals = await getCentralBranches(companyId)

  if (centrals.length === 0) {
    const err = new Error('Belum ada Central branch dikonfigurasi untuk company ini. Hubungi admin.') as Error & { statusCode?: number }
    err.statusCode = 400
    throw err
  }

  if (userProvidedBranchId) {
    if (!centrals.some(b => b.id === userProvidedBranchId)) {
      const err = new Error('Branch yang dipilih bukan Central branch yang valid untuk company ini') as Error & { statusCode?: number }
      err.statusCode = 400
      throw err
    }
    return userProvidedBranchId
  }

  if (centrals.length === 1) {
    return centrals[0].id
  }

  const err = new Error(
    'Company memiliki lebih dari 1 Central branch. Pilih salah satu via parameter branch_id.'
  ) as Error & { statusCode?: number }
  err.statusCode = 400
  throw err
}
