
/**
 * Monitoring Repository
 * Repository layer untuk audit log dan error monitoring operations
 */

import { supabase } from '../../config/supabase'
import {
  AuditLogCreationError,
  AuditLogFetchError,
  ErrorReportCreationError,
  ErrorReportFetchError,
  ErrorStatsFetchError,
  CleanupOperationError,
  ArchiveOperationError
} from './monitoring.errors'
import type { AuditLogRecord, ErrorLogRecord, CleanupPreview, CleanupResult, ArchiveResult } from './monitoring.types'
import { cleanupConfig } from '../../config/audit.config'
import { logInfo, logError } from '../../config/logger'

export interface AuditLogFilters {
  entityType?: string
  entityId?: string
  userId?: string
  action?: string
  startDate?: string
  endDate?: string
}

export interface AuditLogPagination {
  limit: number
  offset: number
}

export interface PaginatedAuditLogs {
  data: AuditLogRecord[]
  total: number
  limit: number
  offset: number
}

export class MonitoringRepository {
  // =========================================================================
  // AUDIT LOG OPERATIONS
  // =========================================================================

  /**
   * Create audit log entry
   */
  async createAuditLog(auditData: {
    action: string
    entityType: string
    entityId: string
    changedBy: string | null
    oldValue?: any
    newValue?: any
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    const { error } = await supabase
      .from('perm_audit_log')
      .insert({
        action: auditData.action,
        entity_type: auditData.entityType,
        entity_id: auditData.entityId,
        changed_by: auditData.changedBy,
        old_value: auditData.oldValue ? JSON.stringify(auditData.oldValue) : null,
        new_value: auditData.newValue ? JSON.stringify(auditData.newValue) : null,
        ip_address: auditData.ipAddress,
        user_agent: auditData.userAgent
      })

    if (error) {
      throw new AuditLogCreationError(error as Error)
    }
  }

  /**
   * Get audit logs with filters and pagination
   */
  async getAuditLogs(
    filters: AuditLogFilters,
    pagination: AuditLogPagination
  ): Promise<PaginatedAuditLogs> {
    let query = supabase
      .from('perm_audit_log')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType)
    }

    if (filters.entityId) {
      query = query.eq('entity_id', filters.entityId)
    }

    if (filters.userId) {
      query = query.eq('changed_by', filters.userId)
    }

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    const { data, error, count } = await query
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) {
      throw new AuditLogFetchError(error as Error)
    }

    return {
      data: (data || []) as AuditLogRecord[],
      total: count || 0,
      limit: pagination.limit,
      offset: pagination.offset
    }
  }

  /**
   * Get single audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLogRecord | null> {
    const { data, error } = await supabase
      .from('perm_audit_log')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new AuditLogFetchError(error as Error)
    }

    return data as AuditLogRecord | null
  }

  // =========================================================================
  // ERROR REPORT OPERATIONS
  // =========================================================================

  /**
   * Create error report entry
   */
  async createErrorReport(errorData: {
    errorName: string
    errorMessage: string
    errorStack?: string
    errorType: string
    severity: string
    module: string
    submodule?: string
    userId?: string
    branchId?: string
    url: string
    route: string
    userAgent: string
    businessImpact?: string
    context?: Record<string, any>
  }): Promise<void> {
    const { error } = await supabase
      .from('error_logs')
      .insert({
        error_name: errorData.errorName,
        error_message: errorData.errorMessage,
        error_stack: errorData.errorStack,
        error_type: errorData.errorType,
        severity: errorData.severity,
        module: errorData.module,
        submodule: errorData.submodule,
        user_id: errorData.userId,
        branch_id: errorData.branchId,
        url: errorData.url,
        route: errorData.route,
        user_agent: errorData.userAgent,
        business_impact: errorData.businessImpact,
        context: errorData.context ? JSON.stringify(errorData.context) : null
      })

    if (error) {
      throw new ErrorReportCreationError(error as Error)
    }
  }

  /**
   * Get error logs with filters and pagination
   */
  async getErrorLogs(
    filters: {
      severity?: string
      errorType?: string
      module?: string
      userId?: string
      startDate?: string
      endDate?: string
    },
    pagination: { limit: number; offset: number }
  ): Promise<{ data: ErrorLogRecord[]; total: number }> {
    let query = supabase
      .from('error_logs')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    if (filters.errorType) {
      query = query.eq('error_type', filters.errorType)
    }

    if (filters.module) {
      query = query.eq('module', filters.module)
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    const { data, error, count } = await query
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) {
      throw new ErrorReportFetchError(error as Error)
    }

    return {
      data: (data || []) as ErrorLogRecord[],
      total: count || 0
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(): Promise<{
    total: number
    bySeverity: Record<string, number>
    byType: Record<string, number>
  }> {
    const { data, error } = await supabase
      .from('error_logs')
      .select('severity, error_type')

    if (error) {
      throw new ErrorStatsFetchError(error as Error)
    }

    const bySeverity: Record<string, number> = {}
    const byType: Record<string, number> = {}
    let total = 0

    for (const item of data || []) {
      total++
      bySeverity[item.severity || 'UNKNOWN'] = (bySeverity[item.severity || 'UNKNOWN'] || 0) + 1
      byType[item.error_type || 'UNKNOWN'] = (byType[item.error_type || 'UNKNOWN'] || 0) + 1
    }

    return { total, bySeverity, byType }
  }

  // =========================================================================
  // CLEANUP OPERATIONS (Retention Policy)
  // =========================================================================

  /**
   * Cleanup old audit logs (retention policy)
   * @param olderThan - Date older than which logs should be deleted
   * @returns Number of deleted records
   */
  async cleanupOldAuditLogs(olderThan: Date): Promise<number> {
    const { count, error } = await supabase
      .from('perm_audit_log')
      .delete()
      .lt('created_at', olderThan.toISOString())

    if (error) {
      throw new AuditLogFetchError(error as Error)
    }

    return count || 0
  }

  /**
   * Cleanup old error logs (retention policy)
   * @param olderThan - Date older than which logs should be deleted
   * @returns Number of deleted records
   */
  async cleanupOldErrorLogs(olderThan: Date): Promise<number> {
    const { count, error } = await supabase
      .from('error_logs')
      .delete()
      .lt('created_at', olderThan.toISOString())

    if (error) {
      throw new ErrorReportFetchError(error as Error)
    }

    return count || 0
  }

  // =========================================================================
  // ADVANCED CLEANUP OPERATIONS
  // =========================================================================

  /**
   * Cleanup old audit logs with batching (untuk dataset besar)
   * @param olderThan - Date older than which logs should be deleted
   * @param batchSize - Number of records per batch (default from config)
   * @returns Object with total deleted count and number of batches
   */
  async cleanupOldAuditLogsBatched(
    olderThan: Date,
    batchSize: number = cleanupConfig.defaultBatchSize
  ): Promise<CleanupResult> {
    let totalDeleted = 0
    let batches = 0
    
    while (true) {
      // Ambil IDs yang akan dihapus (limit batchSize)
      const { data: ids, error: selectError } = await supabase
        .from('perm_audit_log')
        .select('id')
        .lt('created_at', olderThan.toISOString())
        .limit(batchSize)
      
      if (selectError) {
        logError('Error fetching audit log IDs for cleanup', { error: selectError })
        throw new AuditLogFetchError(selectError as Error)
      }
      
      if (!ids || ids.length === 0) {
        break
      }
      
      // Delete batch
      const { count, error: deleteError } = await supabase
        .from('perm_audit_log')
        .delete()
        .in('id', ids.map(i => i.id))
      
      if (deleteError) {
        logError('Error deleting audit log batch', { error: deleteError })
        throw new CleanupOperationError('Failed to delete audit log batch', deleteError as Error)
      }
      
      totalDeleted += count || 0
      batches++
      
      logInfo(`Audit cleanup batch ${batches}: deleted ${count} records`)
      
      // Optional: delay antar batch
      await new Promise(resolve => setTimeout(resolve, cleanupConfig.batchDelayMs))
    }
    
    logInfo(`Audit cleanup completed: ${totalDeleted} records deleted in ${batches} batches`)
    
    return { deleted: totalDeleted, batches }
  }

  /**
   * Preview what will be deleted (dry run)
   * @param olderThan - Date older than which logs would be deleted
   * @returns Preview object with estimated records, size, and distribution
   */
  async previewCleanupAuditLogs(olderThan: Date): Promise<CleanupPreview> {
    // Hitung total records
    const { count, error: countError } = await supabase
      .from('perm_audit_log')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', olderThan.toISOString())
    
    if (countError) {
      throw new AuditLogFetchError(countError as Error)
    }
    
    // Ambil sample untuk estimasi size (PostgreSQL)
    const { data: sample, error: sampleError } = await supabase
      .from('perm_audit_log')
      .select('created_at, entity_type')
      .lt('created_at', olderThan.toISOString())
      .limit(1000)
    
    if (sampleError) {
      throw new AuditLogFetchError(sampleError as Error)
    }
    
    // Group by entity type
    const byEntityType: Record<string, number> = {}
    let oldest = new Date()
    let newest = new Date(0)
    
    for (const item of sample || []) {
      byEntityType[item.entity_type] = (byEntityType[item.entity_type] || 0) + 1
      
      const date = new Date(item.created_at)
      if (date < oldest) oldest = date
      if (date > newest) newest = date
    }
    
    // Estimasi: 1KB per record (average)
    const estimatedSizeMB = ((count || 0) * 1024) / (1024 * 1024)
    
    return {
      totalRecords: count || 0,
      totalSize: `${estimatedSizeMB.toFixed(2)} MB`,
      dateRange: { oldest, newest },
      byEntityType
    }
  }

  /**
   * Archive ke cold storage sebelum delete
   * @param olderThan - Date older than which logs should be archived and deleted
   * @param archivePath - Path untuk menyimpan file archive
   * @returns Object with archived count, deleted count, and archive path
   */
  async archiveAndCleanupAuditLogs(
    olderThan: Date,
    archivePath: string
  ): Promise<ArchiveResult> {
    // 1. Ambil data yang akan dihapus
    const { data: logsToArchive, error: fetchError } = await supabase
      .from('perm_audit_log')
      .select('*')
      .lt('created_at', olderThan.toISOString())
    
    if (fetchError) {
      throw new AuditLogFetchError(fetchError as Error)
    }
    
    if (!logsToArchive || logsToArchive.length === 0) {
      return { archived: 0, deleted: 0, archivePath: '' }
    }
    
    // 2. Simpan ke file (JSON)
    const fs = require('fs').promises
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const archiveFile = `${archivePath}/audit-logs-${timestamp}.json`
    
    // Ensure directory exists
    await fs.mkdir(archivePath, { recursive: true })
    await fs.writeFile(archiveFile, JSON.stringify(logsToArchive, null, 2))
    
    // 3. Delete dari database
    const { count, error: deleteError } = await supabase
      .from('perm_audit_log')
      .delete()
      .lt('created_at', olderThan.toISOString())
    
    if (deleteError) {
      logError('Error deleting archived audit logs', { error: deleteError })
      throw new CleanupOperationError('Failed to delete archived audit logs', deleteError as Error)
    }
    
    // 4. Log archival
    logInfo(`Archived ${logsToArchive.length} records to ${archiveFile}`)
    
    return {
      archived: logsToArchive.length,
      deleted: count || 0,
      archivePath: archiveFile
    }
  }

  /**
   * Soft delete (mark as deleted) - tambahkan deleted_at
   * @param olderThan - Date older than which logs should be soft-deleted
   * @returns Number of records soft-deleted
   */
  async softDeleteOldAuditLogs(olderThan: Date): Promise<number> {
    const { count, error } = await supabase
      .from('perm_audit_log')
      .update({ deleted_at: new Date().toISOString() })
      .lt('created_at', olderThan.toISOString())
      .is('deleted_at', null) // Yang belum di-soft-delete
    
    if (error) {
      throw new CleanupOperationError('Failed to soft delete audit logs', error as Error)
    }
    
    logInfo(`Soft deleted ${count || 0} audit log records`)
    return count || 0
  }

  /**
   * Hard delete (permanent) - untuk data yang sudah di-soft-delete > 30 hari
   * @param olderThan - Date older than which soft-deleted logs should be permanently deleted
   * @returns Number of records permanently deleted
   */
  async hardDeleteSoftDeletedLogs(olderThan: Date): Promise<number> {
    const { count, error } = await supabase
      .from('perm_audit_log')
      .delete()
      .lt('deleted_at', olderThan.toISOString())
      .not('deleted_at', 'is', null)
    
    if (error) {
      throw new CleanupOperationError('Failed to hard delete audit logs', error as Error)
    }
    
    logInfo(`Hard deleted ${count || 0} audit log records`)
    return count || 0
  }

  /**
   * Cleanup old error logs with batching (untuk dataset besar)
   * @param olderThan - Date older than which logs should be deleted
   * @param batchSize - Number of records per batch (default from config)
   * @returns Object with total deleted count and number of batches
   */
  async cleanupOldErrorLogsBatched(
    olderThan: Date,
    batchSize: number = cleanupConfig.defaultBatchSize
  ): Promise<CleanupResult> {
    let totalDeleted = 0
    let batches = 0
    
    while (true) {
      // Ambil IDs yang akan dihapus (limit batchSize)
      const { data: ids, error: selectError } = await supabase
        .from('error_logs')
        .select('id')
        .lt('created_at', olderThan.toISOString())
        .limit(batchSize)
      
      if (selectError) {
        logError('Error fetching error log IDs for cleanup', { error: selectError })
        throw new ErrorReportFetchError(selectError as Error)
      }
      
      if (!ids || ids.length === 0) {
        break
      }
      
      // Delete batch
      const { count, error: deleteError } = await supabase
        .from('error_logs')
        .delete()
        .in('id', ids.map(i => i.id))
      
      if (deleteError) {
        logError('Error deleting error log batch', { error: deleteError })
        throw new CleanupOperationError('Failed to delete error log batch', deleteError as Error)
      }
      
      totalDeleted += count || 0
      batches++
      
      logInfo(`Error log cleanup batch ${batches}: deleted ${count} records`)
      
      // Optional: delay antar batch
      await new Promise(resolve => setTimeout(resolve, cleanupConfig.batchDelayMs))
    }
    
    logInfo(`Error log cleanup completed: ${totalDeleted} records deleted in ${batches} batches`)
    
    return { deleted: totalDeleted, batches }
  }

  /**
   * Preview error logs cleanup (dry run)
   * @param olderThan - Date older than which logs would be deleted
   * @returns Preview object with estimated records and distribution
   */
  async previewCleanupErrorLogs(olderThan: Date): Promise<CleanupPreview> {
    // Hitung total records
    const { count, error: countError } = await supabase
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', olderThan.toISOString())
    
    if (countError) {
      throw new ErrorReportFetchError(countError as Error)
    }
    
    // Ambil sample untuk estimasi
    const { data: sample, error: sampleError } = await supabase
      .from('error_logs')
      .select('created_at, error_type, severity')
      .lt('created_at', olderThan.toISOString())
      .limit(1000)
    
    if (sampleError) {
      throw new ErrorReportFetchError(sampleError as Error)
    }
    
    // Group by error type dan severity
    const byEntityType: Record<string, number> = {}
    let oldest = new Date()
    let newest = new Date(0)
    
    for (const item of sample || []) {
      const key = `${item.error_type}_${item.severity}`
      byEntityType[key] = (byEntityType[key] || 0) + 1
      
      const date = new Date(item.created_at)
      if (date < oldest) oldest = date
      if (date > newest) newest = date
    }
    
    // Estimasi: 2KB per record (average)
    const estimatedSizeMB = ((count || 0) * 2048) / (1024 * 1024)
    
    return {
      totalRecords: count || 0,
      totalSize: `${estimatedSizeMB.toFixed(2)} MB`,
      dateRange: { oldest, newest },
      byEntityType
    }
  }
}

// Export singleton instance
export const monitoringRepository = new MonitoringRepository()

