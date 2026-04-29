import { pool } from "../../config/db";
import {
  AuditLogCreationError, AuditLogFetchError, ErrorReportCreationError,
  ErrorReportFetchError, ErrorStatsFetchError, 
} from "./monitoring.errors";
import type { AuditLogRecord, ErrorLogRecord, ErrorStats, CleanupPreview, CleanupResult, ArchiveResult } from "./monitoring.types";
import { cleanupConfig } from "./monitoring.config";
import { logInfo, logError } from "../../config/logger";

export interface AuditLogFilters { entityType?: string; entityId?: string; userId?: string; action?: string; startDate?: string; endDate?: string; search?: string }
export interface AuditLogPagination { limit: number; offset: number }
export interface PaginatedAuditLogs { data: AuditLogRecord[]; total: number; limit: number; offset: number }

export class MonitoringRepository {
  async createAuditLog(auditData: { action: string; entityType: string; entityId: string; changedBy: string | null; changedByName?: string | null; oldValue?: unknown; newValue?: unknown; ipAddress?: string; userAgent?: string }): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO perm_audit_log (action, entity_type, entity_id, changed_by, changed_by_name, old_value, new_value, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [auditData.action, auditData.entityType, auditData.entityId, auditData.changedBy, auditData.changedByName || null,
         auditData.oldValue ? JSON.stringify(auditData.oldValue) : null, auditData.newValue ? JSON.stringify(auditData.newValue) : null,
         auditData.ipAddress, auditData.userAgent]
      )
    } catch (error) { throw new AuditLogCreationError(error as Error) }
  }

  async getAuditLogs(filters: AuditLogFilters, pagination: AuditLogPagination): Promise<PaginatedAuditLogs> {
    const conditions: string[] = []
    const params: string[] = []
    let idx = 1

    if (filters.entityType) { params.push(filters.entityType); conditions.push(`entity_type = $${idx}`); idx++ }
    if (filters.entityId) { params.push(filters.entityId); conditions.push(`entity_id = $${idx}`); idx++ }
    if (filters.userId) { params.push(filters.userId); conditions.push(`changed_by = $${idx}`); idx++ }
    if (filters.action) { params.push(filters.action); conditions.push(`action = $${idx}`); idx++ }
    if (filters.startDate) { params.push(filters.startDate); conditions.push(`created_at >= $${idx}`); idx++ }
    if (filters.endDate) { params.push(filters.endDate); conditions.push(`created_at <= $${idx}`); idx++ }
    if (filters.search) {
      const term = `%${filters.search.replace(/[%_\\]/g, '\\$&')}%`
      params.push(term); conditions.push(`(action ILIKE $${idx} OR entity_type ILIKE $${idx} OR changed_by_name ILIKE $${idx})`); idx++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    try {
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM perm_audit_log ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM perm_audit_log ${where}`, params)
      ])

      const mappedData = dataRes.rows.map((row: Record<string, unknown>) => ({ ...row, user_id: row.changed_by, user_name: row.changed_by_name || null }))
      return { data: mappedData as AuditLogRecord[], total: countRes.rows[0].total, limit: pagination.limit, offset: pagination.offset }
    } catch (error) { throw new AuditLogFetchError(error as Error) }
  }

  async getAuditLogById(id: string): Promise<AuditLogRecord | null> {
    const { rows } = await pool.query('SELECT * FROM perm_audit_log WHERE id = $1', [id])
    return (rows[0] as AuditLogRecord) ?? null
  }

  async createErrorReport(errorData: { errorName: string; errorMessage: string; errorStack?: string; errorType: string; severity: string; module: string; submodule?: string; userId?: string; branchId?: string; url: string; route: string; userAgent: string; businessImpact?: string; context?: Record<string, unknown> }): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO error_logs (error_name, error_message, error_stack, error_type, severity, module, submodule, user_id, branch_id, url, route, user_agent, business_impact, context) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
        [errorData.errorName, errorData.errorMessage, errorData.errorStack, errorData.errorType, errorData.severity, errorData.module, errorData.submodule, errorData.userId, errorData.branchId, errorData.url, errorData.route, errorData.userAgent, errorData.businessImpact, errorData.context ? JSON.stringify(errorData.context) : null]
      )
    } catch (error) { throw new ErrorReportCreationError(error as Error) }
  }

  async getErrorLogs(filters: { severity?: string; errorType?: string; module?: string; userId?: string; startDate?: string; endDate?: string; search?: string }, pagination: { limit: number; offset: number }): Promise<{ data: ErrorLogRecord[]; total: number }> {
    const conditions: string[] = []
    const params: string[] = []
    let idx = 1

    if (filters.severity) { params.push(filters.severity); conditions.push(`el.severity = $${idx}`); idx++ }
    if (filters.errorType) { params.push(filters.errorType); conditions.push(`el.error_type = $${idx}`); idx++ }
    if (filters.module) { params.push(filters.module); conditions.push(`el.module = $${idx}`); idx++ }
    if (filters.userId) { params.push(filters.userId); conditions.push(`el.user_id = $${idx}`); idx++ }
    if (filters.startDate) { params.push(filters.startDate); conditions.push(`el.created_at >= $${idx}`); idx++ }
    if (filters.endDate) { params.push(filters.endDate); conditions.push(`el.created_at <= $${idx}`); idx++ }
    if (filters.search) {
      const term = `%${filters.search.replace(/[%_\\]/g, '\\$&')}%`
      params.push(term); conditions.push(`(el.error_message ILIKE $${idx} OR el.error_name ILIKE $${idx})`); idx++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    try {
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT el.*, e.full_name AS user_name, au.email AS user_email FROM error_logs el LEFT JOIN employees e ON e.user_id = el.user_id LEFT JOIN auth_users au ON au.id = el.user_id ${where} ORDER BY el.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM error_logs el ${where}`, params)
      ])
      return { data: dataRes.rows as ErrorLogRecord[], total: countRes.rows[0].total }
    } catch (error) { throw new ErrorReportFetchError(error as Error) }
  }

  async getErrorStats(): Promise<ErrorStats> {
    try {
      const { rows } = await pool.query('SELECT severity, error_type, module, created_at FROM error_logs WHERE deleted_at IS NULL')
      const by_severity: Record<string, number> = {}
      const by_type: Record<string, number> = {}
      const by_module: Record<string, number> = {}
      let total_errors = 0, recent_errors = 0
      const oneDayAgo = new Date(); oneDayAgo.setHours(oneDayAgo.getHours() - 24)

      for (const item of rows) {
        total_errors++
        by_severity[item.severity || 'UNKNOWN'] = (by_severity[item.severity || 'UNKNOWN'] || 0) + 1
        by_type[item.error_type || 'UNKNOWN'] = (by_type[item.error_type || 'UNKNOWN'] || 0) + 1
        by_module[item.module || 'UNKNOWN'] = (by_module[item.module || 'UNKNOWN'] || 0) + 1
        if (new Date(item.created_at) > oneDayAgo) recent_errors++
      }
      return { total_errors, by_severity, by_type, by_module, recent_errors }
    } catch (error) { throw new ErrorStatsFetchError(error as Error) }
  }

  async getErrorTrend(days = 30): Promise<Array<{ date: string; total: number; critical: number; high: number; medium: number; low: number }>> {
    try {
      const { rows } = await pool.query(`
        SELECT
          created_at::date AS date,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical,
          COUNT(*) FILTER (WHERE severity = 'HIGH')::int AS high,
          COUNT(*) FILTER (WHERE severity = 'MEDIUM')::int AS medium,
          COUNT(*) FILTER (WHERE severity = 'LOW')::int AS low
        FROM error_logs
        WHERE deleted_at IS NULL AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY created_at::date ORDER BY date
      `, [days])
      return rows
    } catch (error) { throw new ErrorStatsFetchError(error as Error) }
  }

  async getErrorGrouped(days = 30): Promise<Array<{ error_name: string; error_message: string; module: string; severity: string; count: number; last_seen: string }>> {
    try {
      const { rows } = await pool.query(`
        SELECT error_name, error_message, module, severity,
          COUNT(*)::int AS count, MAX(created_at) AS last_seen
        FROM error_logs WHERE deleted_at IS NULL AND created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY error_name, error_message, module, severity
        ORDER BY count DESC, last_seen DESC LIMIT 50
      `, [days])
      return rows
    } catch (error) { throw new ErrorStatsFetchError(error as Error) }
  }

  async cleanupOldAuditLogs(olderThan: Date): Promise<number> {
    const { rowCount } = await pool.query('DELETE FROM perm_audit_log WHERE created_at < $1', [olderThan.toISOString()])
    return rowCount ?? 0
  }

  async cleanupOldErrorLogs(olderThan: Date): Promise<number> {
    const { rowCount } = await pool.query('DELETE FROM error_logs WHERE created_at < $1', [olderThan.toISOString()])
    return rowCount ?? 0
  }

  async cleanupOldAuditLogsBatched(olderThan: Date, batchSize = cleanupConfig.defaultBatchSize): Promise<CleanupResult> {
    let totalDeleted = 0, batches = 0
    while (true) {
      const { rows: ids } = await pool.query('SELECT id FROM perm_audit_log WHERE created_at < $1 LIMIT $2', [olderThan.toISOString(), batchSize])
      if (!ids.length) break
      const { rowCount } = await pool.query('DELETE FROM perm_audit_log WHERE id = ANY($1::uuid[])', [ids.map((i: { id: string }) => i.id)])
      totalDeleted += rowCount ?? 0; batches++
      logInfo(`Audit cleanup batch ${batches}: deleted ${rowCount} records`)
      await new Promise(resolve => setTimeout(resolve, cleanupConfig.batchDelayMs))
    }
    return { deleted: totalDeleted, batches }
  }

  async previewCleanupAuditLogs(olderThan: Date): Promise<CleanupPreview> {
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM perm_audit_log WHERE created_at < $1', [olderThan.toISOString()])
    const totalRecords = countRows[0].cnt
    const { rows: sample } = await pool.query('SELECT created_at, entity_type FROM perm_audit_log WHERE created_at < $1 LIMIT 1000', [olderThan.toISOString()])

    const byEntityType: Record<string, number> = {}
    let oldest = new Date(), newest = new Date(0)
    for (const item of sample) {
      byEntityType[item.entity_type] = (byEntityType[item.entity_type] || 0) + 1
      const date = new Date(item.created_at)
      if (date < oldest) oldest = date
      if (date > newest) newest = date
    }

    return { totalRecords, totalSize: `${((totalRecords * 1024) / (1024 * 1024)).toFixed(2)} MB`, dateRange: { oldest, newest }, byEntityType }
  }

  async archiveAndCleanupAuditLogs(olderThan: Date, archivePath: string): Promise<ArchiveResult> {
    const { rows } = await pool.query('SELECT * FROM perm_audit_log WHERE created_at < $1', [olderThan.toISOString()])
    if (!rows.length) return { archived: 0, deleted: 0, archivePath: '' }

    const fs = require('fs').promises
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const archiveFile = `${archivePath}/audit-logs-${timestamp}.json`
    await fs.mkdir(archivePath, { recursive: true })
    await fs.writeFile(archiveFile, JSON.stringify(rows, null, 2))

    const { rowCount } = await pool.query('DELETE FROM perm_audit_log WHERE created_at < $1', [olderThan.toISOString()])
    logInfo(`Archived ${rows.length} records to ${archiveFile}`)
    return { archived: rows.length, deleted: rowCount ?? 0, archivePath: archiveFile }
  }

  async softDeleteOldAuditLogs(olderThan: Date): Promise<number> {
    const { rowCount } = await pool.query('UPDATE perm_audit_log SET deleted_at = NOW() WHERE created_at < $1 AND deleted_at IS NULL', [olderThan.toISOString()])
    return rowCount ?? 0
  }

  async hardDeleteSoftDeletedLogs(olderThan: Date): Promise<number> {
    const { rowCount } = await pool.query('DELETE FROM perm_audit_log WHERE deleted_at < $1 AND deleted_at IS NOT NULL', [olderThan.toISOString()])
    return rowCount ?? 0
  }

  async cleanupOldErrorLogsBatched(olderThan: Date, batchSize = cleanupConfig.defaultBatchSize): Promise<CleanupResult> {
    let totalDeleted = 0, batches = 0
    while (true) {
      const { rows: ids } = await pool.query('SELECT id FROM error_logs WHERE created_at < $1 LIMIT $2', [olderThan.toISOString(), batchSize])
      if (!ids.length) break
      const { rowCount } = await pool.query('DELETE FROM error_logs WHERE id = ANY($1::uuid[])', [ids.map((i: { id: string }) => i.id)])
      totalDeleted += rowCount ?? 0; batches++
      logInfo(`Error log cleanup batch ${batches}: deleted ${rowCount} records`)
      await new Promise(resolve => setTimeout(resolve, cleanupConfig.batchDelayMs))
    }
    return { deleted: totalDeleted, batches }
  }

  async previewCleanupErrorLogs(olderThan: Date): Promise<CleanupPreview> {
    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM error_logs WHERE created_at < $1', [olderThan.toISOString()])
    const totalRecords = countRows[0].cnt
    const { rows: sample } = await pool.query('SELECT created_at, error_type, severity FROM error_logs WHERE created_at < $1 LIMIT 1000', [olderThan.toISOString()])

    const byEntityType: Record<string, number> = {}
    let oldest = new Date(), newest = new Date(0)
    for (const item of sample) {
      const key = `${item.error_type}_${item.severity}`
      byEntityType[key] = (byEntityType[key] || 0) + 1
      const date = new Date(item.created_at)
      if (date < oldest) oldest = date
      if (date > newest) newest = date
    }

    return { totalRecords, totalSize: `${((totalRecords * 2048) / (1024 * 1024)).toFixed(2)} MB`, dateRange: { oldest, newest }, byEntityType }
  }

  async bulkDeleteAuditLogs(ids: string[]): Promise<number> {
    let totalDeleted = 0
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000)
      const { rowCount } = await pool.query('DELETE FROM perm_audit_log WHERE id = ANY($1::uuid[])', [chunk])
      totalDeleted += rowCount ?? 0
    }
    return totalDeleted
  }

  async bulkSoftDeleteAuditLogs(ids: string[]): Promise<number> {
    const { rowCount } = await pool.query('UPDATE perm_audit_log SET deleted_at = NOW() WHERE id = ANY($1::uuid[])', [ids])
    return rowCount ?? 0
  }

  async bulkDeleteErrorLogs(ids: string[]): Promise<number> {
    let totalDeleted = 0
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000)
      const { rowCount } = await pool.query('DELETE FROM error_logs WHERE id = ANY($1::uuid[])', [chunk])
      totalDeleted += rowCount ?? 0
    }
    return totalDeleted
  }

  async bulkSoftDeleteErrorLogs(ids: string[]): Promise<number> {
    const { rowCount } = await pool.query('UPDATE error_logs SET deleted_at = NOW() WHERE id = ANY($1::uuid[])', [ids])
    return rowCount ?? 0
  }
}

export const monitoringRepository = new MonitoringRepository();
