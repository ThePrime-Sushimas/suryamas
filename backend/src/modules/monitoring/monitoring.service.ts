/**
 * Audit Service
 * Service layer untuk audit logging operations
 * Menggunakan MonitoringRepository untuk operasi database
 */

import { monitoringRepository } from './monitoring.repository'
import { logInfo, logError } from '../../config/logger'

export class AuditService {
  /**
   * Log an audit entry
   * @param action - Action type (CREATE, UPDATE, DELETE, RESTORE)
   * @param entityType - Type of entity being audited
   * @param entityId - ID of the entity
   * @param changedBy - User ID who made the change
   * @param oldValue - Previous value (for updates)
   * @param newValue - New value (for creates/updates)
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   */
  static async log(
    action: string,
    entityType: string,
    entityId: string,
    changedBy: string | null,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Log to console for development
      logInfo('Audit Log', {
        action,
        entityType,
        entityId,
        changedBy,
        timestamp: new Date().toISOString()
      })

      // Use repository for database operation
      await monitoringRepository.createAuditLog({
        action,
        entityType,
        entityId,
        changedBy,
        oldValue,
        newValue,
        ipAddress,
        userAgent
      })
    } catch (err) {
      logError('Failed to create audit log', { error: err })
      // Don't throw - audit logging should not break main operation
    }
  }
}
