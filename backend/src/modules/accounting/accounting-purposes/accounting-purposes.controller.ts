import { Response } from 'express'
import { accountingPurposesService } from './accounting-purposes.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../../utils/export.util'
import { 
  createAccountingPurposeSchema, 
  updateAccountingPurposeSchema, 
  bulkUpdateStatusSchema, 
  bulkDeleteSchema 
} from './accounting-purposes.schema'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import { AccountingPurposeErrors } from './accounting-purposes.errors'
import { defaultConfig } from './accounting-purposes.config'
import { randomBytes } from 'crypto'

export class AccountingPurposesController {
  /**
   * Generates a correlation ID for request tracking
   * @returns Unique correlation ID
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36)
    const entropy = randomBytes(defaultConfig.correlation.entropyBytes).toString('hex')
    return `${defaultConfig.correlation.idPrefix}_${timestamp}_${entropy}`
  }

  /**
   * Extracts and validates company ID from branch context
   * @param req Request object
   * @returns Company ID
   */
  private getCompanyId(req: AuthenticatedRequest | AuthenticatedQueryRequest): string {
    // Use company_id from branch context instead of query parameter for security
    const companyId = (req as any).context?.company_id
    if (!companyId) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('company_id', 'Branch context required - no company access')
    }
    return companyId
  }

  private validateCompanyAccess(userId: string, companyId: string): void {
    // Company access is already validated by branch context middleware
    // This is just an additional safety check
    if (!companyId) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('company_id', 'No company context available')
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
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${defaultConfig.limits.pageSize}`)
      }

      const result = await accountingPurposesService.list(
        companyId,
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams,
        correlationId
      )
      
      this.logResponse('LIST', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Accounting purposes retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('LIST', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async search(req: AuthenticatedQueryRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const { q } = req.query
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('SEARCH', correlationId, req.user?.id, { query: q, company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      if (q && typeof q === 'string' && q.length > 100) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('searchTerm', 'Search term too long')
      }

      const result = await accountingPurposesService.search(
        companyId,
        q as string, 
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams,
        correlationId
      )
      
      this.logResponse('SEARCH', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Accounting purposes retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('SEARCH', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createAccountingPurposeSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      // Override company_id from context for security
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const createData = {
        ...req.validated.body,
        company_id: companyId, // Force use context company_id
        branch_id: req.validated.body.branch_id || null // Allow branch selection
      }
      
      this.logRequest('CREATE', correlationId, req.user!.id, { 
        purpose_code: createData.purpose_code,
        company_id: createData.company_id
      })
      
      const purpose = await accountingPurposesService.create(createData, req.user!.id, correlationId)
      
      this.logResponse('CREATE', correlationId, true, Date.now() - startTime)
      logInfo('Accounting purpose created', {
        correlation_id: correlationId,
        purpose_id: purpose.id,
        purpose_code: purpose.purpose_code,
        user: req.user!.id
      })
      sendSuccess(res, purpose, 'Accounting purpose created', 201)
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
        purpose_id: req.params.id,
        company_id: companyId
      })
      
      const purpose = await accountingPurposesService.getById(req.params.id, companyId, correlationId)
      
      this.logResponse('GET_BY_ID', correlationId, true, Date.now() - startTime)
      sendSuccess(res, purpose)
    } catch (error) {
      this.logResponse('GET_BY_ID', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateAccountingPurposeSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { body, params } = req.validated
      
      this.logRequest('UPDATE', correlationId, req.user!.id, {
        purpose_id: params.id,
        company_id: companyId
      })

      logInfo(`Request received: ${req.method} ${req.path}`, {
        correlation_id: correlationId,
        user_id: req.user!.id
      })

      const purpose = await accountingPurposesService.update(params.id, body, req.user!.id, companyId, correlationId)
      
      this.logResponse('UPDATE', correlationId, true, Date.now() - startTime)
      logInfo('Accounting purpose updated', {
        correlation_id: correlationId,
        purpose_id: params.id,
        user: req.user!.id
      })
      sendSuccess(res, purpose, 'Accounting purpose updated')
    } catch (error) {
      this.logResponse('UPDATE', correlationId, false, Date.now() - startTime)
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
        throw AccountingPurposeErrors.VALIDATION_ERROR('user', 'User authentication required')
      }
      
      this.logRequest('DELETE', correlationId, req.user.id, { 
        purpose_id: req.params.id,
        company_id: companyId
      })
      
      await accountingPurposesService.delete(req.params.id, req.user.id, companyId, correlationId)
      
      this.logResponse('DELETE', correlationId, true, Date.now() - startTime)
      logInfo('Accounting purpose deleted', {
        correlation_id: correlationId,
        purpose_id: req.params.id,
        user: req.user.id
      })
      sendSuccess(res, null, 'Accounting purpose deleted')
    } catch (error) {
      this.logResponse('DELETE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('GET_FILTER_OPTIONS', correlationId, req.user?.id, { company_id: companyId })
      
      const options = await accountingPurposesService.getFilterOptions(companyId, correlationId)
      sendSuccess(res, options)
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
        (filter) => accountingPurposesService.exportToExcel(companyId, filter, correlationId), 
        'accounting-purposes'
      )
    } catch (error) {
      handleError(res, error)
    }
  }

  async previewImport(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      this.logRequest('IMPORT_PREVIEW', correlationId, req.user?.id)
      
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > maxSize) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('fileSize', 'File too large')
      }
      
      return handleImportPreview(req, res, (buffer) => accountingPurposesService.previewImport(buffer, correlationId))
    } catch (error) {
      handleError(res, error)
    }
  }

  async importData(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('IMPORT', correlationId, req.user!.id, { company_id: companyId })
      
      return handleImport(
        req, 
        res, 
        (buffer, skip) => accountingPurposesService.importFromExcel(buffer, skip, companyId, req.user!.id, correlationId)
      )
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids, is_active } = req.validated.body
      
      this.logRequest('BULK_UPDATE_STATUS', correlationId, req.user!.id, { 
        count: ids.length,
        is_active,
        company_id: companyId
      })
      
      if (ids.length > defaultConfig.limits.bulkUpdate) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Cannot update more than ${defaultConfig.limits.bulkUpdate} records at once`)
      }
      
      await accountingPurposesService.bulkUpdateStatus(ids, is_active, req.user!.id, companyId, correlationId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
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
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`)
      }
      
      await accountingPurposesService.bulkDelete(ids, req.user!.id, companyId, correlationId)
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
        throw AccountingPurposeErrors.VALIDATION_ERROR('user', 'User authentication required')
      }
      
      this.logRequest('RESTORE', correlationId, req.user.id, { 
        purpose_id: req.params.id,
        company_id: companyId
      })
      
      await accountingPurposesService.restore(req.params.id, req.user.id, companyId, correlationId)
      
      this.logResponse('RESTORE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, null, 'Accounting purpose restored')
    } catch (error) {
      this.logResponse('RESTORE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async bulkRestore(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids } = req.validated.body
      
      this.logRequest('BULK_RESTORE', correlationId, req.user!.id, { 
        count: ids.length,
        company_id: companyId
      })
      
      await accountingPurposesService.bulkRestore(ids, req.user!.id, companyId, correlationId)
      sendSuccess(res, null, 'Bulk restore completed')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const accountingPurposesController = new AccountingPurposesController()