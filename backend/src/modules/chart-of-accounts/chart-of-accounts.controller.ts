import { Response } from 'express'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { ChartOfAccountError } from './chart-of-accounts.errors'
import { 
  createChartOfAccountSchema, 
  updateChartOfAccountSchema, 
  bulkUpdateStatusSchema, 
  bulkDeleteSchema 
} from './chart-of-accounts.schema'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { randomUUID } from 'crypto'

export class ChartOfAccountsController {
  private generateCorrelationId(): string {
    return randomUUID()
  }

  private getCompanyId(req: AuthenticatedRequest | AuthenticatedQueryRequest): string {
    const companyId = req.query.company_id as string
    if (!companyId) {
      throw new Error('Company ID is required')
    }
    return companyId
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
      this.logRequest('LIST', correlationId, req.user?.id, { company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      // Validate pagination limits
      if (req.pagination.limit > 1000) {
        return sendError(res, 'Page size cannot exceed 1000', 400)
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
      logError('Failed to list chart of accounts', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      
      if ((error as Error).message === 'Company ID is required') {
        return sendError(res, 'Company ID is required', 400)
      }
      sendError(res, 'Failed to retrieve chart of accounts', 500)
    }
  }

  async search(req: AuthenticatedQueryRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const { q } = req.query
      const companyId = this.getCompanyId(req)
      this.logRequest('SEARCH', correlationId, req.user?.id, { query: q, company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      // Validate search term
      if (q && typeof q === 'string' && q.length > 100) {
        return sendError(res, 'Search term too long', 400)
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
      logError('Failed to search chart of accounts', {
        correlation_id: correlationId,
        error: (error as Error).message,
        query: req.query.q,
        user: req.user?.id
      })
      sendError(res, 'Failed to search chart of accounts', 500)
    }
  }

  async getTree(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      const maxDepth = req.query.max_depth ? parseInt(req.query.max_depth as string) : undefined
      
      this.logRequest('GET_TREE', correlationId, req.user?.id, { company_id: companyId, max_depth: maxDepth })
      
      // Validate max depth
      if (maxDepth && (maxDepth < 1 || maxDepth > 10)) {
        return sendError(res, 'Max depth must be between 1 and 10', 400)
      }

      const tree = await chartOfAccountsService.getTree(companyId, maxDepth)
      
      this.logResponse('GET_TREE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, tree, 'Chart of accounts tree retrieved')
    } catch (error) {
      this.logResponse('GET_TREE', correlationId, false, Date.now() - startTime)
      logError('Failed to get chart of accounts tree', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, 'Failed to retrieve chart of accounts tree', 500)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createChartOfAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      this.logRequest('CREATE', correlationId, req.user!.id, { 
        account_code: req.validated.body.account_code,
        company_id: req.validated.body.company_id
      })
      
      const account = await chartOfAccountsService.create(req.validated.body, req.user!.id)
      
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
      if (error instanceof ChartOfAccountError) {
        logError('Failed to create chart of account', { 
          correlation_id: correlationId,
          code: error.code,
          message: error.message,
          user: req.user?.id 
        })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Unexpected error creating chart of account', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, 'Failed to create chart of account', 500)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      this.logRequest('GET_BY_ID', correlationId, req.user?.id, { 
        account_id: req.params.id,
        company_id: companyId
      })
      
      const account = await chartOfAccountsService.getById(req.params.id, companyId)
      
      this.logResponse('GET_BY_ID', correlationId, true, Date.now() - startTime)
      sendSuccess(res, account)
    } catch (error) {
      this.logResponse('GET_BY_ID', correlationId, false, Date.now() - startTime)
      if (error instanceof ChartOfAccountError) {
        logError('Failed to get chart of account', { 
          correlation_id: correlationId,
          code: error.code, 
          id: req.params.id 
        })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Failed to get chart of account', {
        correlation_id: correlationId,
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, 'Failed to retrieve chart of account', 500)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateChartOfAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = req.query.company_id as string
      if (!companyId) {
        return sendError(res, 'Company ID is required', 400)
      }
      
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
      if (error instanceof ChartOfAccountError) {
        logError('Failed to update chart of account', { 
          correlation_id: correlationId,
          code: error.code, 
          id: req.params.id 
        })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Unexpected error updating chart of account', {
        correlation_id: correlationId,
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, 'Failed to update chart of account', 500)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
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
      if (error instanceof ChartOfAccountError) {
        logError('Failed to delete chart of account', { 
          correlation_id: correlationId,
          code: error.code, 
          id: req.params.id 
        })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Unexpected error deleting chart of account', {
        correlation_id: correlationId,
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, 'Failed to delete chart of account', 500)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.logRequest('GET_FILTER_OPTIONS', correlationId, req.user?.id, { company_id: companyId })
      
      const options = await chartOfAccountsService.getFilterOptions(companyId)
      sendSuccess(res, options)
    } catch (error) {
      logError('Failed to get filter options', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, 'Failed to retrieve filter options', 500)
    }
  }

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.logRequest('EXPORT', correlationId, req.user?.id, { company_id: companyId })
      
      return handleExport(
        req, 
        res, 
        (filter) => chartOfAccountsService.exportToExcel(companyId, filter), 
        'chart-of-accounts'
      )
    } catch (error) {
      logError('Failed to export chart of accounts', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      return sendError(res, 'Failed to export data', 500)
    }
  }

  async previewImport(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      this.logRequest('IMPORT_PREVIEW', correlationId, req.user?.id)
      
      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > maxSize) {
        return sendError(res, 'File too large', 413)
      }
      
      return handleImportPreview(req, res, (buffer) => chartOfAccountsService.previewImport(buffer))
    } catch (error) {
      logError('Failed to preview import', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      return sendError(res, 'Failed to preview import', 500)
    }
  }

  async importData(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.logRequest('IMPORT', correlationId, req.user!.id, { company_id: companyId })
      
      return handleImport(
        req, 
        res, 
        (buffer, skip) => chartOfAccountsService.importFromExcel(buffer, skip, companyId, req.user!.id)
      )
    } catch (error) {
      logError('Failed to import chart of accounts', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      return sendError(res, 'Failed to import data', 500)
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = req.query.company_id as string
      if (!companyId) {
        return sendError(res, 'Company ID is required', 400)
      }
      
      const { ids, is_active } = req.validated.body
      
      this.logRequest('BULK_UPDATE_STATUS', correlationId, req.user!.id, { 
        count: ids.length,
        is_active,
        company_id: companyId
      })
      
      // Validate bulk operation size
      if (ids.length > 1000) {
        return sendError(res, 'Cannot update more than 1000 records at once', 400)
      }
      
      await chartOfAccountsService.bulkUpdateStatus(ids, is_active, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
      if (error instanceof ChartOfAccountError) {
        return sendError(res, error.message, error.statusCode)
      }
      logError('Failed to bulk update status', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, 'Failed to update status', 500)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = req.query.company_id as string
      if (!companyId) {
        return sendError(res, 'Company ID is required', 400)
      }
      
      const { ids } = req.validated.body
      
      this.logRequest('BULK_DELETE', correlationId, req.user!.id, { 
        count: ids.length,
        company_id: companyId
      })
      
      // Validate bulk operation size
      if (ids.length > 100) {
        return sendError(res, 'Cannot delete more than 100 records at once', 400)
      }
      
      await chartOfAccountsService.bulkDelete(ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error) {
      if (error instanceof ChartOfAccountError) {
        return sendError(res, error.message, error.statusCode)
      }
      logError('Failed to bulk delete', {
        correlation_id: correlationId,
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, 'Failed to delete records', 500)
    }
  }
}

export const chartOfAccountsController = new ChartOfAccountsController()