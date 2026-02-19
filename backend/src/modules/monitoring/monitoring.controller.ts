/**
 * Monitoring Controller
 * 
 * Handles error logging endpoint. Audit trail uses existing AuditService.
 */

import { Request, Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.util'
import { logInfo, logError } from '@/config/logger'
import { AuditService } from './monitoring.service'
import type { ErrorReport, AuditLogEntry } from './monitoring.types'
import { monitoringRepository } from './monitoring.repository'
import { getPaginationParams } from '@/utils/pagination.util'

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
    
    // Transform to database format and store in database
    const errorData = {
      errorName: errorReport.error.name,
      errorMessage: errorReport.error.message,
      errorStack: errorReport.error.stack,
      errorType: errorReport.category.type,
      severity: errorReport.category.severity,
      module: errorReport.module,
      submodule: errorReport.submodule,
      userId: errorReport.context.userId,
      branchId: errorReport.context.branchId,
      url: errorReport.context.url,
      route: errorReport.context.route,
      userAgent: errorReport.context.userAgent,
      businessImpact: errorReport.businessImpact,
      context: errorReport.context
    }
    
    await monitoringRepository.createErrorReport(errorData)
    
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
    const stats = await monitoringRepository.getErrorStats()
    sendSuccess(res, stats)
  } catch (error) {
    logError('Failed to get error stats', { error })
    sendError(res, error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

/**
 * Get error logs with pagination
 * GET /api/v1/monitoring/errors
 */
export const getErrorLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>)
    
    const filters = {
      severity: req.query.severity as string | undefined,
      errorType: req.query.errorType as string | undefined,
      module: req.query.module as string | undefined,
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined
    }
    
    const result = await monitoringRepository.getErrorLogs(filters, pagination)
    
    sendSuccess(res, result.data, 'Error logs retrieved successfully', 200, {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      hasNext: pagination.offset + pagination.limit < result.total,
      hasPrev: pagination.offset > 0
    })
  } catch (error) {
    logError('Failed to get error logs', { error })
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
    const pagination = getPaginationParams(req.query as Record<string, unknown>)
    
    const filters = {
      entityType: req.query.entityType as string | undefined,
      action: req.query.action as string | undefined,
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined
    }
    
    const logs = await monitoringRepository.getAuditLogs(filters, pagination)
    sendSuccess(res, logs)
  } catch (error) {
    logError('Failed to get audit logs', { error })
    sendError(res, error instanceof Error ? error.message : 'Unknown error', 500)
  }
}
