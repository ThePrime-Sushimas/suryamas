import { employeePositionsRepository } from './employee-positions.repository'
import { pool } from '../../config/db'
import {
  EmployeePositionNotFoundError, EmployeePositionDuplicateError,
  CannotRemoveLastPositionError
} from './employee-positions.errors'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import type { EmployeePositionWithDetails } from './employee-positions.types'

class EmployeePositionsService {

  async listByEmployee(employeeId: string): Promise<EmployeePositionWithDetails[]> {
    return employeePositionsRepository.findByEmployee(employeeId)
  }

  async listByUser(userId: string): Promise<EmployeePositionWithDetails[]> {
    return employeePositionsRepository.findByUserPositions(userId)
  }

  async assign(employeeId: string, positionId: string, isPrimary: boolean, userId: string): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Check if already exists (active or deleted)
      const { rows: existing } = await client.query(
        `SELECT id, is_deleted FROM employee_positions WHERE employee_id = $1 AND position_id = $2`,
        [employeeId, positionId]
      )

      if (existing.length > 0 && !existing[0].is_deleted) {
        throw new EmployeePositionDuplicateError()
      }

      // If assigning as primary, clear existing primary atomically
      if (isPrimary) {
        await client.query(
          `UPDATE employee_positions SET is_primary = false WHERE employee_id = $1 AND is_primary = true AND is_deleted = false`,
          [employeeId]
        )
      }

      if (existing.length > 0 && existing[0].is_deleted) {
        // Restore soft-deleted record
        await client.query(
          `UPDATE employee_positions SET is_deleted = false, deleted_at = NULL, is_primary = $1, assigned_by = $2, assigned_at = now()
           WHERE id = $3`,
          [isPrimary, userId || null, existing[0].id]
        )
      } else {
        // Insert new
        await client.query(
          `INSERT INTO employee_positions (employee_id, position_id, is_primary, assigned_by)
           VALUES ($1, $2, $3, $4)`,
          [employeeId, positionId, isPrimary, userId || null]
        )
      }

      await client.query('COMMIT')
      await AuditService.log('CREATE', 'employee_position', employeeId, userId, undefined, { position_id: positionId, is_primary: isPrimary })
    } catch (err: unknown) {
      await client.query('ROLLBACK')
      if (err instanceof EmployeePositionDuplicateError) throw err
      if (isPostgresError(err, '23505')) throw new EmployeePositionDuplicateError()
      throw err
    } finally {
      client.release()
    }
  }

  async remove(employeeId: string, positionId: string, userId: string): Promise<void> {
    const existing = await employeePositionsRepository.findOne(employeeId, positionId)
    if (!existing) throw new EmployeePositionNotFoundError()

    // Check: cannot remove last position
    const count = await employeePositionsRepository.countActive(employeeId)
    if (count <= 1) throw new CannotRemoveLastPositionError()

    await employeePositionsRepository.remove(employeeId, positionId)

    // If removed position was primary, set another one as primary
    if (existing.is_primary) {
      const remaining = await employeePositionsRepository.findByEmployee(employeeId)
      if (remaining.length > 0) {
        await employeePositionsRepository.setPrimary(employeeId, remaining[0].position_id)
      }
    }

    await AuditService.log('DELETE', 'employee_position', employeeId, userId, { position_id: positionId })
  }

  async setPrimary(employeeId: string, positionId: string, userId: string): Promise<void> {
    const existing = await employeePositionsRepository.findOne(employeeId, positionId)
    if (!existing) throw new EmployeePositionNotFoundError()

    await employeePositionsRepository.setPrimary(employeeId, positionId)
    await AuditService.log('UPDATE', 'employee_position', employeeId, userId, undefined, { position_id: positionId, is_primary: true })
  }
}

export const employeePositionsService = new EmployeePositionsService()
