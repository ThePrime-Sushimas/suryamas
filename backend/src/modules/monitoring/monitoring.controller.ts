import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logError } from '../../config/logger'
import { AuditService } from './monitoring.service'
import type { ErrorReport, AuditLogEntry } from './monitoring.types'
import { monitoringRepository } from './monitoring.repository'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'

export const logErrorReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const errorReport: ErrorReport = req.body
    logError('Frontend Error Report', { ...errorReport, reported_at: new Date().toISOString() })

    await monitoringRepository.createErrorReport({
      errorName: errorReport.error.name, errorMessage: errorReport.error.message,
      errorStack: errorReport.error.stack, errorType: errorReport.category.type,
      severity: errorReport.category.severity, module: errorReport.module, submodule: errorReport.submodule,
      userId: errorReport.context.userId, branchId: errorReport.context.branchId,
      url: errorReport.context.url, route: errorReport.context.route,
      userAgent: errorReport.context.userAgent, businessImpact: errorReport.businessImpact,
      context: errorReport.context,
    })
    sendSuccess(res, { message: 'Error report logged successfully' })
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'log_error_report' })
  }
}

export const logAuditEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const auditEntry: AuditLogEntry = req.body
    logInfo('Audit Trail Entry', { ...auditEntry, logged_at: new Date().toISOString() })

    await AuditService.log(
      auditEntry.action, auditEntry.entityType, auditEntry.entityId || '',
      auditEntry.userId || null, undefined, auditEntry.context,
      undefined, auditEntry.metadata?.userAgent || req.get('user-agent'),
    )
    sendSuccess(res, { message: 'Audit entry logged successfully' })
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'log_audit_entry' })
  }
}

export const getErrorStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await monitoringRepository.getErrorStats()
    sendSuccess(res, stats)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_error_stats' })
  }
}

export const getErrorTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedDays = parseInt(req.query.days as string)
    const days = !isNaN(parsedDays) && parsedDays > 0 ? parsedDays : 30
    const trend = await monitoringRepository.getErrorTrend(days)
    sendSuccess(res, trend)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_error_trend' })
  }
}

export const getErrorGrouped = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedDays = parseInt(req.query.days as string)
    const days = !isNaN(parsedDays) && parsedDays > 0 ? parsedDays : 30
    const grouped = await monitoringRepository.getErrorGrouped(days)
    sendSuccess(res, grouped)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_error_grouped' })
  }
}

export const getErrorLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>)
    const filters = {
      severity: req.query.severity as string | undefined,
      errorType: req.query.errorType as string | undefined,
      module: req.query.module as string | undefined,
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
    }
    const result = await monitoringRepository.getErrorLogs(filters, pagination)
    const response = createPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
    sendSuccess(res, response.data, 'Error logs retrieved successfully', 200, response.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_error_logs' })
  }
}

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagination = getPaginationParams(req.query as Record<string, unknown>)
    const filters = {
      entityType: req.query.entityType as string | undefined,
      action: req.query.action as string | undefined,
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
    }
    const result = await monitoringRepository.getAuditLogs(filters, pagination)
    const response = createPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
    sendSuccess(res, response.data, 'Audit logs retrieved successfully', 200, response.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_audit_logs' })
  }
}

export const bulkActionAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, action } = req.body
    if (!Array.isArray(ids) || ids.length === 0) { sendError(res, 'Invalid or empty IDs list', 400); return }
    if (action !== 'delete' && action !== 'soft-delete') { sendError(res, 'Invalid action', 400); return }

    const count = action === 'delete'
      ? await monitoringRepository.bulkDeleteAuditLogs(ids)
      : await monitoringRepository.bulkSoftDeleteAuditLogs(ids)
    sendSuccess(res, { count }, `Successfully processed ${count} audit logs`)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'bulk_action_audit' })
  }
}

export const bulkActionErrorLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, action } = req.body
    if (!Array.isArray(ids) || ids.length === 0) { sendError(res, 'Invalid or empty IDs list', 400); return }
    if (action !== 'delete' && action !== 'soft-delete') { sendError(res, 'Invalid action', 400); return }

    const count = action === 'delete'
      ? await monitoringRepository.bulkDeleteErrorLogs(ids)
      : await monitoringRepository.bulkSoftDeleteErrorLogs(ids)
    sendSuccess(res, { count }, `Successfully processed ${count} error logs`)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'bulk_action_errors' })
  }
}
