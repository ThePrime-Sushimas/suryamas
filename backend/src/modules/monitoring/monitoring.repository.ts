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
  ErrorStatsFetchError
} from './monitoring.errors'
import { DatabaseError } from '../../utils/errors.base'
import type { AuditLogEntry, AuditLogRecord, ErrorReport, ErrorLogRecord } from './monitoring.types'

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
}

// Export singleton instance
export const monitoringRepository = new MonitoringRepository()

