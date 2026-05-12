import { pool } from '../config/db'

const branchCache = new Map<string, { branches: string[]; expiresAt: number }>()
const CACHE_TTL = 30_000 // 30 seconds

export function invalidateBranchCache(userId?: string): void {
  if (userId) branchCache.delete(userId)
  else branchCache.clear()
}

export async function getAccessibleBranchIds(userId: string): Promise<string[]> {
  const cached = branchCache.get(userId)
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

  branchCache.set(userId, { branches, expiresAt: Date.now() + CACHE_TTL })
  return branches
}
