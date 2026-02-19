/**
 * Audit Service
 * Service layer untuk audit logging operations
 * Menggunakan MonitoringRepository untuk operasi database
 */

import { monitoringRepository } from './monitoring.repository'
import { logInfo, logError } from '../../config/logger'
import { auditRetentionPolicy, retentionDays } from '../../config/audit.config'
import type { CleanupPreview, CleanupResult, ArchiveResult } from './monitoring.types'

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

/**
 * Cleanup Service
 * Service layer untuk audit log cleanup operations
 * Menggunakan MonitoringRepository untuk operasi database
 */
export class CleanupService {
  /**
   * Get default retention date based on policy
   * @param policyType - 'hot', 'warm', or 'cold'
   * @returns Date object representing the retention threshold
   */
  static getRetentionDate(policyType: 'hot' | 'warm' | 'cold' = 'hot'): Date {
    const days = retentionDays.auditLogs[policyType]
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  }

  /**
   * Preview cleanup (dry run) - show what would be deleted
   * @param olderThan - Date threshold
   * @returns Preview object with estimated records to be deleted
   */
  static async previewCleanup(olderThan: Date): Promise<CleanupPreview> {
    logInfo('Starting audit log cleanup preview...')
    const preview = await monitoringRepository.previewCleanupAuditLogs(olderThan)
    logInfo('Cleanup preview completed', preview)
    return preview
  }

  /**
   * Preview cleanup with default hot retention policy
   * @returns Preview object with estimated records to be deleted
   */
  static async previewCleanupWithDefaultPolicy(): Promise<CleanupPreview> {
    const olderThan = this.getRetentionDate('hot')
    return this.previewCleanup(olderThan)
  }

  /**
   * Cleanup audit logs with batching (recommended for large datasets)
   * @param olderThan - Date threshold
   * @param batchSize - Number of records per batch
   * @returns Result with deleted count and number of batches
   */
  static async cleanupWithBatching(
    olderThan: Date,
    batchSize?: number
  ): Promise<CleanupResult> {
    logInfo('Starting batched audit log cleanup...')
    const result = await monitoringRepository.cleanupOldAuditLogsBatched(olderThan, batchSize)
    logInfo('Batched cleanup completed', result)
    return result
  }

  /**
   * Cleanup audit logs with default hot retention policy
   * @param batchSize - Number of records per batch
   * @returns Result with deleted count and number of batches
   */
  static async cleanupWithDefaultPolicy(batchSize?: number): Promise<CleanupResult> {
    const olderThan = this.getRetentionDate('hot')
    return this.cleanupWithBatching(olderThan, batchSize)
  }

  /**
   * Archive and cleanup - saves data before deleting
   * @param olderThan - Date threshold
   * @param archivePath - Path to save archive
   * @returns Result with archived and deleted counts
   */
  static async archiveAndCleanup(
    olderThan: Date,
    archivePath: string = auditRetentionPolicy.auditLogs.cleanup.archivePath
  ): Promise<ArchiveResult> {
    logInfo('Starting archive and cleanup...', { olderThan, archivePath })
    const result = await monitoringRepository.archiveAndCleanupAuditLogs(olderThan, archivePath)
    logInfo('Archive and cleanup completed', result)
    return result
  }

  /**
   * Archive and cleanup with default policy
   * @returns Result with archived and deleted counts
   */
  static async archiveAndCleanupWithDefaultPolicy(): Promise<ArchiveResult> {
    const olderThan = this.getRetentionDate('warm')
    const archivePath = auditRetentionPolicy.auditLogs.cleanup.archivePath
    return this.archiveAndCleanup(olderThan, archivePath)
  }

  /**
   * Soft delete - mark records as deleted without removing
   * @param olderThan - Date threshold
   * @returns Number of records soft-deleted
   */
  static async softDelete(olderThan: Date): Promise<number> {
    logInfo('Starting soft delete...')
    const count = await monitoringRepository.softDeleteOldAuditLogs(olderThan)
    logInfo('Soft delete completed', { count })
    return count
  }

  /**
   * Soft delete with default hot retention policy
   * @returns Number of records soft-deleted
   */
  static async softDeleteWithDefaultPolicy(): Promise<number> {
    const olderThan = this.getRetentionDate('hot')
    return this.softDelete(olderThan)
  }

  /**
   * Hard delete - permanently remove soft-deleted records
   * @param olderThan - Date threshold (should be older than soft delete date)
   * @returns Number of records permanently deleted
   */
  static async hardDelete(olderThan: Date): Promise<number> {
    logInfo('Starting hard delete...')
    const count = await monitoringRepository.hardDeleteSoftDeletedLogs(olderThan)
    logInfo('Hard delete completed', { count })
    return count
  }

  /**
   * Hard delete with default soft delete retention policy
   * @returns Number of records permanently deleted
   */
  static async hardDeleteWithDefaultPolicy(): Promise<number> {
    const olderThan = new Date(
      Date.now() - retentionDays.auditLogs.softDelete * 24 * 60 * 60 * 1000
    )
    return this.hardDelete(olderThan)
  }

  /**
   * Full cleanup cycle: soft delete -> wait -> hard delete
   * Use this for complete cleanup with recovery option
   * @param softDeleteOlderThan - Date threshold for soft delete
   * @param hardDeleteOlderThan - Date threshold for hard delete
   * @returns Object with soft delete and hard delete counts
   */
  static async fullCleanupCycle(
    softDeleteOlderThan: Date,
    hardDeleteOlderThan: Date
  ): Promise<{ softDeleted: number; hardDeleted: number }> {
    logInfo('Starting full cleanup cycle...')
    
    // Step 1: Soft delete
    const softDeleted = await this.softDelete(softDeleteOlderThan)
    
    // Step 2: Hard delete old soft-deleted records
    const hardDeleted = await this.hardDelete(hardDeleteOlderThan)
    
    logInfo('Full cleanup cycle completed', { softDeleted, hardDeleted })
    return { softDeleted, hardDeleted }
  }

  /**
   * Full cleanup cycle with default policies
   * @returns Object with soft delete and hard delete counts
   */
  static async fullCleanupCycleWithDefaultPolicy(): Promise<{ softDeleted: number; hardDeleted: number }> {
    const softDeleteOlderThan = this.getRetentionDate('hot')
    const hardDeleteOlderThan = new Date(
      Date.now() - retentionDays.auditLogs.softDelete * 24 * 60 * 60 * 1000
    )
    return this.fullCleanupCycle(softDeleteOlderThan, hardDeleteOlderThan)
  }
}

/**
 * Error Log Cleanup Service
 * Service layer untuk error log cleanup operations
 */
export class ErrorLogCleanupService {
  /**
   * Get default retention date for error logs
   * @param policyType - 'hot', 'warm', or 'cold'
   * @returns Date object representing the retention threshold
   */
  static getRetentionDate(policyType: 'hot' | 'warm' | 'cold' = 'hot'): Date {
    const days = retentionDays.errorLogs[policyType]
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  }

  /**
   * Preview error logs cleanup (dry run)
   * @param olderThan - Date threshold
   * @returns Preview object with estimated records to be deleted
   */
  static async previewCleanup(olderThan: Date): Promise<CleanupPreview> {
    logInfo('Starting error log cleanup preview...')
    const preview = await monitoringRepository.previewCleanupErrorLogs(olderThan)
    logInfo('Error log cleanup preview completed', preview)
    return preview
  }

  /**
   * Preview error logs cleanup with default hot policy
   * @returns Preview object with estimated records to be deleted
   */
  static async previewCleanupWithDefaultPolicy(): Promise<CleanupPreview> {
    const olderThan = this.getRetentionDate('hot')
    return this.previewCleanup(olderThan)
  }

  /**
   * Cleanup error logs with batching
   * @param olderThan - Date threshold
   * @param batchSize - Number of records per batch
   * @returns Result with deleted count and number of batches
   */
  static async cleanupWithBatching(
    olderThan: Date,
    batchSize?: number
  ): Promise<CleanupResult> {
    logInfo('Starting batched error log cleanup...')
    const result = await monitoringRepository.cleanupOldErrorLogsBatched(olderThan, batchSize)
    logInfo('Batched error log cleanup completed', result)
    return result
  }

  /**
   * Cleanup error logs with default hot retention policy
   * @param batchSize - Number of records per batch
   * @returns Result with deleted count and number of batches
   */
  static async cleanupWithDefaultPolicy(batchSize?: number): Promise<CleanupResult> {
    const olderThan = this.getRetentionDate('hot')
    return this.cleanupWithBatching(olderThan, batchSize)
  }
}
