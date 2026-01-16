/**
 * Monitoring Controller
 * 
 * Handles error logging endpoint. Audit trail uses existing AuditService.
 */

import { Request, Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.util'
import { logInfo, logError } from '@/config/logger'
import { AuditService } from '@/services/audit.service'
import type { ErrorReport, AuditLogEntry } from './monitoring.types'

/**
 * Log error report from frontend
 * POST /api/v1/monitoring/errors
 */
export const logErrorReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const errorReport: ErrorReport = req.body
    
    // Log to Winston
    logError('Frontend Error Report', {
      ...errorReport,
      reported_at: new Date().toISOString()
    })
    
    // TODO: Store in database (error_logs table)
    // await monitoringRepository.createErrorLog(errorReport)
    
    // TODO: Send alerts for critical errors
    // if (errorReport.category.severity === 'CRITICAL') {
    //   await alertService.sendCriticalErrorAlert(errorReport)
    // }
    
    sendSuccess(res, { message: 'Error report logged successfully' })
  } catch (error) {
    logError('Failed to log error report', { error })
    sendError(res, error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

/**
 * Log audit trail entry from frontend
 * POST /api/v1/monitoring/audit
 * 
 * Uses existing AuditService and perm_audit_log table
 */
export const logAuditEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const auditEntry: AuditLogEntry = req.body
    
    // Log to Winston for development
    logInfo('Audit Trail Entry', {
      ...auditEntry,
      logged_at: new Date().toISOString()
    })
    
    // Use existing AuditService
    await AuditService.log(
      auditEntry.action,
      auditEntry.entityType,
      auditEntry.entityId || '',
      auditEntry.userId || null,
      undefined, // oldValue - not applicable for frontend confirmations
      auditEntry.context, // newValue - store context as new value
      undefined, // ipAddress - could be extracted from req
      auditEntry.metadata?.userAgent || req.get('user-agent')
    )
    
    sendSuccess(res, { message: 'Audit entry logged successfully' })
  } catch (error) {
    logError('Failed to log audit entry', { error })
    sendError(res, error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

/**
 * Get error statistics
 * GET /api/v1/monitoring/errors/stats
 */
export const getErrorStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement error statistics from error_logs table
    // const stats = await monitoringRepository.getErrorStats()
    
    const stats = {
      total: 0,
      by_severity: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
      },
      by_type: {
        NETWORK: 0,
        PERMISSION: 0,
        DATA_VALIDATION: 0,
        BUSINESS_RULE: 0,
        SYSTEM: 0
      }
    }
    
    sendSuccess(res, stats)
  } catch (error) {
    logError('Failed to get error stats', { error })
    sendError(res, error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

/**
 * Get audit trail logs
 * GET /api/v1/monitoring/audit
 * 
 * Queries existing perm_audit_log table
 */
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement audit log retrieval with pagination from perm_audit_log
    // const logs = await monitoringRepository.getAuditLogs(filters, pagination)
    
    const logs = {
      data: [],
      total: 0
    }
    
    sendSuccess(res, logs)
  } catch (error) {
    logError('Failed to get audit logs', { error })
    sendError(res, error instanceof Error ? error.message : 'Unknown error', 500)
  }
}
