import { Response } from 'express'
import { fiscalPeriodsService } from './fiscal-periods.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport } from '../../../utils/export.util'

import { getParamString } from '../../../utils/validation.util'
import { 
  createFiscalPeriodSchema, 
  updateFiscalPeriodSchema, 
  closePeriodSchema,
  bulkDeleteSchema,
  bulkRestoreSchema
} from './fiscal-periods.schema'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import { FiscalPeriodErrors } from './fiscal-periods.errors'
import { defaultConfig } from './fiscal-periods.config'
import { randomBytes } from 'crypto'

export class FiscalPeriodsController {
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36)
    const entropy = randomBytes(8).toString('hex')
    return `fp_${timestamp}_${entropy}`
  }

  private getCompanyId(req: AuthenticatedRequest | AuthenticatedQueryRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('company_id', 'Branch context required - no company access')
    }
    return companyId
  }

  private validateCompanyAccess(userId: string, companyId: string): void {
    if (!companyId) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('company_id', 'No company context available')
    }
  }

  private logRequest(method: string, correlationId: string, userId?: string, extra?: any): void {
    logInfo(`${method} request started`, {
      correlation_id: correlationId,
      user_id: userId,
      ...extra
    })
  }

  private logResponse(method: string, correlationId: string, success: boolean, duration: number): void {
    logInfo(`${method} request completed`, {
      correlation_id: correlationId,
      success,
      duration_ms: duration
    })
  }

  async list(req: AuthenticatedQueryRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('LIST', correlationId, req.user?.id, { company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      if (req.pagination.limit > defaultConfig.limits.pageSize) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${defaultConfig.limits.pageSize}`)
      }

      const result = await fiscalPeriodsService.list(
        companyId,
        { ...req.pagination, offset }, 
        req.sort as any, 
        req.filterParams,
        correlationId
      )
      
      this.logResponse('LIST', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Fiscal periods retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('LIST', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createFiscalPeriodSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const createData = {
        ...req.validated.body,
        company_id: companyId
      }
      
      this.logRequest('CREATE', correlationId, req.user!.id, { 
        period: createData.period,
        company_id: createData.company_id
      })
      
      const period = await fiscalPeriodsService.create(createData, req.user!.id, correlationId)
      
      this.logResponse('CREATE', correlationId, true, Date.now() - startTime)
      logInfo('Fiscal period created', {
        correlation_id: correlationId,
        period_id: period.id,
        period: period.period,
        user: req.user!.id
      })
      sendSuccess(res, period, 'Fiscal period created', 201)
    } catch (error) {
      this.logResponse('CREATE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('GET_BY_ID', correlationId, req.user?.id, { 
        period_id: getParamString(req.params.id),
        company_id: companyId
      })
      
      const period = await fiscalPeriodsService.getById(getParamString(req.params.id), companyId, correlationId)
      
      this.logResponse('GET_BY_ID', correlationId, true, Date.now() - startTime)
      sendSuccess(res, period)
    } catch (error) {
      this.logResponse('GET_BY_ID', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateFiscalPeriodSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { body, params } = req.validated
      
      this.logRequest('UPDATE', correlationId, req.user!.id, { 
        period_id: params.id,
        company_id: companyId
      })
      
      const period = await fiscalPeriodsService.update(params.id, body, req.user!.id, companyId, correlationId)
      
      this.logResponse('UPDATE', correlationId, true, Date.now() - startTime)
      logInfo('Fiscal period updated', {
        correlation_id: correlationId,
        period_id: params.id,
        user: req.user!.id
      })
      sendSuccess(res, period, 'Fiscal period updated')
    } catch (error) {
      this.logResponse('UPDATE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async closePeriod(req: ValidatedAuthRequest<typeof closePeriodSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { params, body } = req.validated
      
      this.logRequest('CLOSE_PERIOD', correlationId, req.user!.id, { 
        period_id: params.id,
        company_id: companyId
      })
      
      const period = await fiscalPeriodsService.closePeriod(
        params.id, 
        req.user!.id, 
        companyId, 
        body.close_reason || undefined,
        correlationId
      )
      
      this.logResponse('CLOSE_PERIOD', correlationId, true, Date.now() - startTime)
      logInfo('Fiscal period closed', {
        correlation_id: correlationId,
        period_id: params.id,
        period: period.period,
        user: req.user!.id
      })
      sendSuccess(res, period, 'Fiscal period closed')
    } catch (error) {
      this.logResponse('CLOSE_PERIOD', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      if (!req.user?.id) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('user', 'User authentication required')
      }
      
      this.logRequest('DELETE', correlationId, req.user.id, { 
        period_id: getParamString(req.params.id),
        company_id: companyId
      })
      
      await fiscalPeriodsService.delete(getParamString(req.params.id), req.user.id, companyId, correlationId)
      
      this.logResponse('DELETE', correlationId, true, Date.now() - startTime)
      logInfo('Fiscal period deleted', {
        correlation_id: correlationId,
        period_id: getParamString(req.params.id),
        user: req.user.id
      })
      sendSuccess(res, null, 'Fiscal period deleted')
    } catch (error) {
      this.logResponse('DELETE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids } = req.validated.body
      
      this.logRequest('BULK_DELETE', correlationId, req.user!.id, { 
        count: ids.length,
        company_id: companyId
      })
      
      if (ids.length > defaultConfig.limits.bulkDelete) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`)
      }
      
      await fiscalPeriodsService.bulkDelete(ids, req.user!.id, companyId, correlationId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async restore(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      if (!req.user?.id) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('user', 'User authentication required')
      }
      
      this.logRequest('RESTORE', correlationId, req.user.id, { 
        period_id: getParamString(req.params.id),
        company_id: companyId
      })
      
      await fiscalPeriodsService.restore(getParamString(req.params.id), req.user.id, companyId, correlationId)
      
      this.logResponse('RESTORE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, null, 'Fiscal period restored')
    } catch (error) {
      this.logResponse('RESTORE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async bulkRestore(req: ValidatedAuthRequest<typeof bulkRestoreSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids } = req.validated.body
      
      this.logRequest('BULK_RESTORE', correlationId, req.user!.id, { 
        count: ids.length,
        company_id: companyId
      })
      
      await fiscalPeriodsService.bulkRestore(ids, req.user!.id, companyId, correlationId)
      sendSuccess(res, null, 'Bulk restore completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('EXPORT', correlationId, req.user?.id, { company_id: companyId })
      
      return handleExport(
        req, 
        res, 
        (filter) => fiscalPeriodsService.exportToExcel(companyId, filter, correlationId), 
        'fiscal-periods'
      )
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const fiscalPeriodsController = new FiscalPeriodsController()
