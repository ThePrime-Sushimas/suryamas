import { Response } from 'express'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../../utils/export.util'
import { 
  createChartOfAccountSchema, 
  updateChartOfAccountSchema, 
  bulkUpdateStatusSchema, 
  bulkDeleteSchema 
} from './chart-of-accounts.schema'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import { CompanyAccessService } from '../../../services/company-access.service'
import { randomUUID } from 'crypto'

export class ChartOfAccountsController {
  private generateCorrelationId(): string {
    return randomUUID()
  }

  private getCompanyId(req: AuthenticatedRequest | AuthenticatedQueryRequest): string {
    // Use company_id from branch context instead of query parameter for security
    const companyId = (req as any).context?.company_id
    if (!companyId) {
      throw new Error('Branch context required - no company access')
    }
    return companyId
  }

  private async validateCompanyAccess(userId: string, companyId: string): Promise<void> {
    const hasAccess = await CompanyAccessService.validateUserCompanyAccess(userId, companyId)
    if (!hasAccess) {
      throw new Error('Access denied to this company')
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
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('LIST', correlationId, req.user?.id, { company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      // Validate pagination limits
      if (req.pagination.limit > 1000) {
        throw new Error('Page size cannot exceed 1000')
      }

      const result = await chartOfAccountsService.list(
        companyId,
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams
      )
      
      this.logResponse('LIST', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Chart of accounts retrieved', 200, result.pagination)
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
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('SEARCH', correlationId, req.user?.id, { query: q, company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      // Validate search term
      if (q && typeof q === 'string' && q.length > 100) {
        throw new Error('Search term too long')
      }

      const result = await chartOfAccountsService.search(
        companyId,
        q as string, 
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams
      )
      
      this.logResponse('SEARCH', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Chart of accounts retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('SEARCH', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async getTree(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      const maxDepth = req.query.max_depth ? parseInt(req.query.max_depth as string) : undefined
      
      this.logRequest('GET_TREE', correlationId, req.user?.id, { company_id: companyId, max_depth: maxDepth })
      
      // Validate max depth
      if (maxDepth && (maxDepth < 1 || maxDepth > 10)) {
        throw new Error('Max depth must be between 1 and 10')
      }

      const tree = await chartOfAccountsService.getTree(companyId, maxDepth)
      
      this.logResponse('GET_TREE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, tree, 'Chart of accounts tree retrieved')
    } catch (error) {
      this.logResponse('GET_TREE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createChartOfAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      // Override company_id from context for security
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const createData = {
        ...req.validated.body,
        company_id: companyId // Force use context company_id
      }
      
      this.logRequest('CREATE', correlationId, req.user!.id, { 
        account_code: createData.account_code,
        company_id: createData.company_id
      })
      
      const account = await chartOfAccountsService.create(createData, req.user!.id)
      
      this.logResponse('CREATE', correlationId, true, Date.now() - startTime)
      logInfo('Chart of account created', {
        correlation_id: correlationId,
        account_id: account.id,
        account_code: account.account_code,
        user: req.user!.id
      })
      sendSuccess(res, account, 'Chart of account created', 201)
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
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('GET_BY_ID', correlationId, req.user?.id, { 
        account_id: req.params.id,
        company_id: companyId
      })
      
      const account = await chartOfAccountsService.getById(req.params.id, companyId)
      
      this.logResponse('GET_BY_ID', correlationId, true, Date.now() - startTime)
      sendSuccess(res, account)
    } catch (error) {
      this.logResponse('GET_BY_ID', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateChartOfAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { body, params } = req.validated
      
      this.logRequest('UPDATE', correlationId, req.user!.id, { 
        account_id: params.id,
        company_id: companyId
      })
      
      const account = await chartOfAccountsService.update(params.id, body, req.user!.id, companyId)
      
      this.logResponse('UPDATE', correlationId, true, Date.now() - startTime)
      logInfo('Chart of account updated', {
        correlation_id: correlationId,
        account_id: params.id,
        user: req.user!.id
      })
      sendSuccess(res, account, 'Chart of account updated')
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
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('DELETE', correlationId, req.user.id, { 
        account_id: req.params.id,
        company_id: companyId
      })
      
      await chartOfAccountsService.delete(req.params.id, req.user.id, companyId)
      
      this.logResponse('DELETE', correlationId, true, Date.now() - startTime)
      logInfo('Chart of account deleted', {
        correlation_id: correlationId,
        account_id: req.params.id,
        user: req.user.id
      })
      sendSuccess(res, null, 'Chart of account deleted')
    } catch (error) {
      this.logResponse('DELETE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('GET_FILTER_OPTIONS', correlationId, req.user?.id, { company_id: companyId })
      
      const options = await chartOfAccountsService.getFilterOptions(companyId)
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
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('EXPORT', correlationId, req.user?.id, { company_id: companyId })
      
      return handleExport(
        req, 
        res, 
        (filter) => chartOfAccountsService.exportToExcel(companyId, filter), 
        'chart-of-accounts'
      )
    } catch (error) {
      handleError(res, error)
    }
  }

  async previewImport(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      this.logRequest('IMPORT_PREVIEW', correlationId, req.user?.id)
      
      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > maxSize) {
        throw new Error('File too large')
      }
      
      return handleImportPreview(req, res, (buffer) => chartOfAccountsService.previewImport(buffer))
    } catch (error) {
      handleError(res, error)
    }
  }

  async importData(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('IMPORT', correlationId, req.user!.id, { company_id: companyId })
      
      return handleImport(
        req, 
        res, 
        (buffer, skip) => chartOfAccountsService.importFromExcel(buffer, skip, companyId, req.user!.id)
      )
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids, is_active } = req.validated.body
      
      this.logRequest('BULK_UPDATE_STATUS', correlationId, req.user!.id, { 
        count: ids.length,
        is_active,
        company_id: companyId
      })
      
      // Validate bulk operation size
      if (ids.length > 1000) {
        throw new Error('Cannot update more than 1000 records at once')
      }
      
      await chartOfAccountsService.bulkUpdateStatus(ids, is_active, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids } = req.validated.body
      
      this.logRequest('BULK_DELETE', correlationId, req.user!.id, { 
        count: ids.length,
        company_id: companyId
      })
      
      // Validate bulk operation size
      if (ids.length > 100) {
        throw new Error('Cannot delete more than 100 records at once')
      }
      
      await chartOfAccountsService.bulkDelete(ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const chartOfAccountsController = new ChartOfAccountsController()