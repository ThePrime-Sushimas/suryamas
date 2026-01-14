import { AuthenticatedRequest } from '../types/request.types'

/**
 * Get employee ID from authenticated request
 * Throws error if employee not found (user not linked to employee)
 */
export function getEmployeeId(req: AuthenticatedRequest): string {
  if (!req.employee?.id) {
    throw new Error('Employee not found. User must be linked to an employee record.')
  }
  return req.employee.id
}

/**
 * Get employee ID safely (returns null if not found)
 */
export function getEmployeeIdSafe(req: AuthenticatedRequest): string | null {
  return req.employee?.id || null
}

/**
 * Check if user has employee record
 */
export function hasEmployeeRecord(req: AuthenticatedRequest): boolean {
  return !!req.employee?.id
}

/**
 * Get employee full name
 */
export function getEmployeeName(req: AuthenticatedRequest): string {
  return req.employee?.full_name || req.user.email || 'Unknown'
}

/**
 * Get employee company ID
 * Note: Returns null if company_id not available in employee record
 */
export function getEmployeeCompanyId(req: AuthenticatedRequest): string | null {
  // If company_id exists in employee record
  if ('company_id' in (req.employee || {}) && (req.employee as any).company_id) {
    return (req.employee as any).company_id
  }
  return null
}

/**
 * Validate employee exists and throw if not
 */
export function requireEmployee(req: AuthenticatedRequest): void {
  if (!req.employee?.id) {
    throw new Error('This action requires an employee record. Please contact administrator.')
  }
}
